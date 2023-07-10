const { Logger }			= require('@whi/weblogger');
const log				= new Logger("appstore/openstate");

const common				= require('../common.js');
const { HoloHash,
	HoloHashError,
	EntryHash,
	ActionHash,
	DnaHash,
	AgentPubKey }			= holohash;


function is_holohash ( input, type ) {
    try {
	let hash			= new HoloHash( input );
	return type === undefined
	    ? true
	    : hash.constructor.name === type;
    } catch (err) {
	return false;
    }
}

function assert_holohash ( input, type ) {
    let hash			= new HoloHash( input );
    if ( type && hash.constructor.name !== type )
	throw new TypeError(`Wrong HoloHash type '${hash.constructor.name}'; expected '${type}'`);
}

async function downloadMemory ( devhub, dna_hash, address, dna_name ) {
    let memory				= await devhub.call( dna_hash, "happ_library", `${dna_name}_get_memory`, address );

    const bytes				= new Uint8Array( memory.memory_size );

    const blocks			= await Promise.all(
	memory.block_addresses.map( async block_addr => {
	    return await devhub.call( dna_hash, "happ_library", `${dna_name}_get_memory_block`, block_addr );
	})
    );

    let index				= 0;
    for ( let block of blocks ) {
	bytes.set( block.bytes, index );
	index			       += block.bytes.length;
    }

    return bytes;
}


module.exports				= (appstore, devhub) => ({
    "Agent": {
	"path": "agent/:id",
	"readonly": true,
	async read ({ id }) {
	    if ( id === "me" )
		return await appstore.call("appstore", "appstore_api", "whoami");

	    throw new Error(`Read for any agent is not implemented yet`);
	},
	adapter ( content ) {
	    content.pubkey		= {
		"initial": new AgentPubKey( content.agent_initial_pubkey ),
		"current": new AgentPubKey( content.agent_latest_pubkey ),
	    };

	    delete content.agent_initial_pubkey;
	    delete content.agent_latest_pubkey;
	},
    },
    "Publishers for Agent": {
	"path": "agent/:id/publishers",
	"readonly": true,
	async read ({ id }) {
	    const list			= id === "me"
		  ? await appstore.call("appstore", "appstore_api", "get_my_publishers")
		  : await appstore.call("appstore", "appstore_api", "get_publishers_for_agent", { "for_agent": id });

	    for ( let publisher of list ) {
		const path		= `publisher/${publisher.$id}`;
		this.openstate.state[path]	= publisher;
	    }

	    return list;
	},
    },
    "Apps for Agent": {
	"path": "agent/:id/apps",
	"readonly": true,
	async read ({ id }) {
	    const list			= id === "me"
		  ? await appstore.call("appstore", "appstore_api", "get_my_apps")
		  : await appstore.call("appstore", "appstore_api", "get_apps_for_agent", { "for_agent": id });

	    for ( let app of list ) {
		const path		= `app/${app.$id}`;
		this.openstate.state[path]	= app;
	    }

	    return list;
	},
    },
    "All publishers": {
	"path": "publishers",
	"readonly": true,
	async read () {
	    const list		= await appstore.call("appstore", "appstore_api", "get_all_publishers");

	    for ( let publisher of list ) {
		const path		= `publisher/${publisher.$id}`;
		this.openstate.state[path]	= publisher;
	    }

	    return list;
	},
    },
    "Publisher": {
	"path": "publisher/:id",
	async read ({ id }) {
	    return await appstore.call("appstore", "appstore_api", "get_publisher", { id });
	},
	adapter ( entity ) {
	    entity.icon				= new EntryHash( entity.icon );

	    for ( let i in entity.editors )
		entity.editors[ i ]		= new AgentPubKey( entity.editors[i] );
	},
	defaultMutable () {
	    return {
		"location": {
		    "country": null,
		    "region": null,
		    "city": null,
		},
		"website": {
		    "url": null,
		    "context": "Website",
		},
		"editors": [],
		"metadata": {},
	    };
	},
	async create ( input ) {
	    const publisher		= await appstore.call("appstore", "appstore_api", "create_publisher", input );

	    this.openstate.state[`publisher/${publisher.$id}`] = publisher;

	    return publisher;
	},
	toMutable ({ name, description, location, website, email, icon, metadata }) {
	    return { name, description, location, website, email, icon, metadata };
	},
	async update ({ id }, changed, intent ) {
	    let resp;
	    if ( intent === "deprecation" ) {
		resp		= await appstore.call("appstore", "appstore_api", "deprecate_publisher", {
		    "base": this.state.$action,
		    "message": changed.deprecation,
		});
	    } else {
		if ( changed.icon && !is_holohash( changed.icon, "EntryHash" ) ) {
		    log.normal("Creating new icon memory of size %s for publisher %s", changed.icon.length, this.params.id );
		    const path				= `appstore/memory/${common.randomHex()}`;
		    this.openstate.mutable[path]	= changed.icon;
		    changed.icon			= await this.openstate.write( path );
		    log.info("New icon memory address: %s", changed.icon );
		    this.openstate.purge( path );
		}

		resp		= await appstore.call("appstore", "appstore_api", "update_publisher", {
		    "base": this.state.$action,
		    "properties": changed,
		});
	    }

	    this.openstate.read(`publishers`);
	    this.openstate.read(`agent/me/publishers`);

	    return resp;
	},
	async delete () {
	    throw new Error(`Publishers cannot be deleted`);
	},
	"permissions": {
	    async writable ( publisher ) {
		if ( publisher.deprecation )
		    return false;
		const agent_info	= await this.get("agent/me");
		return common.hashesAreEqual( publisher.author, agent_info.pubkey.initial );
	    },
	},
	validation ( data, rejections, intent ) {
	    console.log("Validating data for %s:", intent, data );
	    if ( intent === "deprecation" ) {
		if ( data.deprecation === undefined )
		    rejections.push(`'Deprecation Reason' is required`);
		else if ( typeof data.deprecation !== "string")
		    rejections.push(`'Deprecation Reason' must be a string`);
		else if ( data.deprecation.trim() === "" )
		    rejections.push(`'Deprecation Reason' cannot be blank`);
		return;
	    }

	    if ( typeof data.name !== "string" || data.name.trim() === "" )
		rejections.push(`Name is required`);

	    if ( !data.location )
		rejections.push(`Location is required`);
	    else {
		if ( typeof data.location.country !== "string" || data.location.country.trim() === "" )
		    rejections.push(`Country is required`);
		if ( typeof data.location.region !== "string" || data.location.region.trim() === "" )
		    rejections.push(`Region is required`);
		if ( typeof data.location.city !== "string" || data.location.city.trim() === "" )
		    rejections.push(`City is required`);
	    }

	    if ( !data.website )
		rejections.push(`Website is required`);
	    else {
		if ( typeof data.website?.url !== "string" || data.website.url.trim() === "" )
		    rejections.push(`Website is required`);
	    }

	    if ( data.icon === undefined )
		rejections.push(`Icon is required`);
	    else if ( data.icon instanceof Uint8Array ) {
		if ( data.icon.length > 204800 )
		    rejections.push(`Icon is too large. Must be smaller than 200KB (204,800 bytes)`);
	    }
	    else {
		try {
		    new EntryHash( data.icon );
		} catch (err) {
		    if ( err instanceof HoloHashError )
			rejections.push(`Icon must be an EntryHash or image bytes (Uint8Array)`);
		}
	    }

	    if ( data.editors !== undefined && data.editors !== null ) {
		if ( !Array.isArray(data.editors) )
		    rejections.push(`Editors must be an array`);
		else {
		    for ( let i in data.editors ) {
			const agent		= data.editors[ i ];
			try {
			    new AgentPubKey( agent );
			} catch (err) {
			    if ( err instanceof HoloHashError )
				rejections.push(`Editor #${i} must be an AgentPubKey`);
			}
		    }
		}
	    }
	},
    },
    "All apps": {
	"path": "apps",
	"readonly": true,
	async read () {
	    const list		= await appstore.call("appstore", "appstore_api", "get_all_apps");

	    for ( let app of list ) {
		const path		= `app/${app.$id}`;
		this.openstate.state[path]	= app;
	    }

	    return list;
	},
    },
    "App": {
	"path": "app/:id",
	async read ({ id }) {
	    return await appstore.call("appstore", "appstore_api", "get_app", { id });
	},
	adapter ( entity ) {
	    entity.icon				= new EntryHash( entity.icon );
	    entity.publisher			= new ActionHash( entity.publisher );

	    entity.devhub_address.dna		= new DnaHash( entity.devhub_address.dna );
	    entity.devhub_address.happ		= new EntryHash( entity.devhub_address.happ );

	    if ( entity.devhub_address.gui )
		entity.devhub_address.gui	= new EntryHash( entity.devhub_address.gui );

	    for ( let i in entity.editors )
		entity.editors[ i ]		= new AgentPubKey( entity.editors[i] );
	},
	defaultMutable () {
	    return {
		"description": "",
		"devhub_address": {
		    "dna": null,
		    "happ": null,
		    "gui": null,
		},
		"editors": [],
		"metadata": {},
	    };
	},
	async create ( input ) {
	    const app		= await appstore.call("appstore", "appstore_api", "create_app", input );

	    this.openstate.state[`app/${app.$id}`] = app;

	    return app;
	},
	toMutable ({ title, subtitle, description, icon, publisher, devhub_address, metadata }) {
	    return {
		title, subtitle, description, icon,
		"publisher":	String( publisher ),
		"devhub_address": {
		    "dna":	String( devhub_address.dna ),
		    "happ":	String( devhub_address.happ ),
		    "gui":	devhub_address.gui ? String( devhub_address.gui ) : devhub_address.gui,
		},
		metadata,
	    };
	},
	async update ({ id }, changed, intent ) {
	    let resp;
	    if ( intent === "deprecation" ) {
		resp		= await appstore.call("appstore", "appstore_api", "deprecate_app", {
		    "base": this.state.$action,
		    "message": changed.deprecation,
		});
	    } else {
		if ( changed.icon && !is_holohash( changed.icon, "EntryHash" ) ) {
		    log.normal("Creating new icon memory of size %s for app %s", changed.icon.length, this.params.id );
		    const path				= `appstore/memory/${common.randomHex()}`;
		    this.openstate.mutable[path]	= changed.icon;
		    changed.icon			= await this.openstate.write( path );
		    log.info("New icon memory address: %s", changed.icon );
		    this.openstate.purge( path );
		}

		resp		= await appstore.call("appstore", "appstore_api", "update_app", {
		    "base": this.state.$action,
		    "properties": changed,
		});
	    }

	    this.openstate.read(`apps`);
	    this.openstate.read(`agent/me/apps`);

	    return resp;
	},
	async delete () {
	    throw new Error(`Apps cannot be deleted`);
	},
	"permissions": {
	    async writable ( app ) {
		if ( app.deprecation )
		    return false;
		const agent_info	= await this.get("agent/me");
		return common.hashesAreEqual( app.author, agent_info.pubkey.initial );
	    },
	},
	validation ( data, rejections, intent ) {
	    if ( intent === "deprecation" ) {
		if ( data.deprecation === undefined )
		    rejections.push(`'Deprecation Reason' is required`);
		else if ( typeof data.deprecation !== "string")
		    rejections.push(`'Deprecation Reason' must be a string`);
		else if ( data.deprecation.trim() === "" )
		    rejections.push(`'Deprecation Reason' cannot be blank`);
		return;
	    }

	    if ( data.icon === undefined )
		rejections.push(`Icon is required`);
	    else if ( data.icon instanceof Uint8Array ) {
		if ( data.icon.length > 204800 )
		    rejections.push(`Icon is too large. Must be smaller than 200KB (204,800 bytes)`);
	    }
	    else {
		try {
		    new EntryHash( data.icon );
		} catch (err) {
		    if ( err instanceof HoloHashError )
			rejections.push(`Icon must be an EntryHash or image bytes (Uint8Array)`);
		}
	    }

	    if ( typeof data.title !== "string" || data.title.trim() === "" )
		rejections.push(`Title is required`);

	    if ( typeof data.subtitle !== "string" || data.subtitle.trim() === "" )
		rejections.push(`Subtitle is required`);

	    if ( typeof data.description !== "string" )
		rejections.push(`Description is required`);

	    if ( data.publisher === undefined )
		rejections.push(`Publisher is required`);
	    else {
		try {
		    new ActionHash( data.publisher );
		} catch (err) {
		    if ( err instanceof HoloHashError )
			rejections.push(`Publisher must be an ActionHash`);
		}
	    }

	    if ( !data.devhub_address )
		rejections.push(`DevHub Address is required`);
	    else {
		if ( !(typeof data.devhub_address.dna === "string"
		       || data.devhub_address.dna instanceof HoloHash ) )
		    rejections.push(`DevHub Address DNA Hash is required`);
		if ( !(typeof data.devhub_address.happ === "string"
		       || data.devhub_address.happ instanceof HoloHash ) )
		    rejections.push(`DevHub Address hApp ID is required`);
		if ( data.devhub_address.gui && !(typeof data.devhub_address.gui === "string"
		       || data.devhub_address.gui instanceof HoloHash ) )
		    rejections.push(`DevHub Address GUI ID must be a string`);
	    }

	    if ( data.editors !== undefined && data.editors !== null ) {
		if ( !Array.isArray(data.editors) )
		    rejections.push(`Editors must be an array`);
		else {
		    for ( let i in data.editors ) {
			const agent		= data.editors[ i ];
			try {
			    new AgentPubKey( agent );
			} catch (err) {
			    if ( err instanceof HoloHashError )
				rejections.push(`Editor #${i} must be an AgentPubKey`);
			}
		    }
		}
	    }
	},
    },
    "App Publisher": {
	"path": "app/:id/publisher",
	"readonly": true,
	async read ({ id }) {
	    const app				= await this.openstate.get(`app/${id}`);
	    return await this.openstate.read(`publisher/${app.publisher}`);
	},
    },
    "Portal Host": {
	"path": "portal/host/:id",
	async read ({ id }) {
	    return await appstore.call("portal", "portal_api", "get_host", {
		id,
	    });
	},
    },
    "DevHub Hosts for DNA": {
	"path": "devhub/hosts/:dna",
	"readonly": true,
	async read ({ dna }) {
	    const list				= await appstore.call("portal", "portal_api", "get_registered_hosts", {
		"dna": dna,
	    });

	    for ( let host of list ) {
		const path			= `portal/host/${host.$id}`;
		this.openstate.state[path]	= host;
	    }

	    return list;
	},
    },
    "DevHub Hosts for DNA/Zome/Function": {
	"path": "devhub/hosts/:dna/:zome/:func",
	"readonly": true,
	async read ({ dna, zome, func }) {
	    const list				= await appstore.call("portal", "portal_api", "get_hosts_for_zome_function", {
		"dna": dna,
		"zome": zome,
		"function": func,
	    });

	    for ( let host of list ) {
		const path			= `portal/host/${host.$id}`;
		this.openstate.state[path]	= host;
	    }

	    return list;
	},
    },
    "DevHub Hosts for DNA/Zome/Function Ping Promises": {
	"path": "devhub/hosts/:dna/:zome/:func/pings",
	"readonly": true,
	async read ({ dna, zome, func }) {
	    const hosts				= await this.openstate.get(`devhub/hosts/${dna}/${zome}/${func}`);

	    if ( hosts.length === 0 )
		throw new Error(`No hosts for ${dna}/${zome}/${func}`);

	    return hosts.map( async host => {
		await appstore.call("portal", "portal_api", "ping", host.author, 1_000 );
		return host;
	    });
	},
    },
    "Active DevHub Hosts for DNA/Zome/Function": {
	"path": "devhub/hosts/:dna/:zome/:func/active",
	"readonly": true,
	async read ({ dna, zome, func }) {
	    const pings				= await this.openstate.get(`devhub/hosts/${dna}/${zome}/${func}/pings`);

	    let active_hosts			= [];
	    for ( let ping of pings ) {
		try {
		    let host			= await ping;
		    active_hosts.push( host );
		} catch (err) {
		    console.error("PING", err );
		}
	    }

	    return active_hosts;
	},
    },
    "Any Available DevHub Host for DNA/Zome/Function": {
	"path": "devhub/hosts/:dna/:zome/:func/any",
	"readonly": true,
	async read ({ dna, zome, func }) {
	    const pings				= await this.openstate.get(`devhub/hosts/${dna}/${zome}/${func}/pings`);
	    return await Promise.any( pings );
	},
    },
    "App Package": {
	"path": "app/:id/package",
	"readonly": true,
	async read ({ id }) {
	    const start_time			= Date.now();
	    const app				= await this.openstate.get(`app/${id}`);
	    console.log("App:", app );
	    const dna_id			= app.devhub_address.dna;
	    const gui_id			= app.devhub_address.gui;
	    const happ_id			= app.devhub_address.happ;

	    const happ_releases			= await devhub.call( app.devhub_address.dna, "happ_library", "get_happ_releases", {
		"for_happ": happ_id,
	    }, 10_000 );

	    if ( happ_releases.length === 0 ) {
		const happ			= await devhub.call( dna_id, "happ_library", "get_happ", {
		    "id": happ_id,
		}, 10_000 );

		throw new Error(`There are no releases for hApp ${happ.title} (${happ.$id})`);
	    }

	    const latest_happ_release		= happ_releases[0];

	    console.log("Latest hApp Release:", latest_happ_release );
	    if ( !(gui_id || latest_happ_release.official_gui) )
		throw new Error(`No Official GUI for hApp Release '${latest_happ_release.version}' (${latest_happ_release.$id})`);

	    let gui_release;
	    let gui_release_id;

	    if ( gui_id ) {
		gui_release			= await this.openstate.get(`${dna_id}/gui/${gui_id}/releases/latest`);
		console.log("Latest GUI Release:", gui_release );

		if ( gui_release === null )
		    throw new Error(`There are no releases for GUI '${gui_id}'`);

		gui_release_id			= gui_release.$id;
	    }
	    else {
		gui_release_id			= new EntryHash( latest_happ_release.official_gui );
		console.log("Official GUI Release ID: %s", gui_release_id );
		gui_release			= await devhub.call( dna_id, "happ_library", "get_gui_release", {
		    "id": gui_release_id,
		});
	    }

	    console.log("GUI Release:", gui_release );
	    const file				= await devhub.call( dna_id, "happ_library", "get_webasset_file", {
		"id": gui_release.web_asset_id,
	    });
	    const ui_bytes_p			= downloadMemory( devhub, dna_id, file.mere_memory_addr, "web_assets" );
	    const happ_bundle_p			= this.openstate.get(`app/${id}/happ/package`, { rememberState: false });

	    const [ui_bytes, happ_bytes]	= await Promise.all([
		// Get GUI file
		ui_bytes_p,
		// Get hApp bundle
		happ_bundle_p,
	    ]);

	    const webhapp_config		= {
		"manifest": {
		    "manifest_version": "1",
		    "name": `${app.title} - ${latest_happ_release.version}`,
		    "ui": {
			"bundled": "ui.zip"
		    },
		    "happ_manifest": {
			"bundled": "bundled.happ"
		    }
		},
		"resources": {
		    "ui.zip":		ui_bytes,
		    "bundled.happ":	happ_bytes,
		},
	    };

	    const msgpacked_bytes	= MessagePack.encode( webhapp_config );
	    const webhapp_bytes		= pako.gzip( msgpacked_bytes );

	    const duration		= Date.now() - start_time;
	    log.debug("%ss to fetch Webhapp %s WASM", duration/1000, id );
	    return webhapp_bytes;
	},
    },
    "GUI Package": {
	"path": "app/:id/gui/package",
	"readonly": true,
	async read ({ id }) {
	},
    },
    "hApp Package": {
	"path": "app/:id/happ/package",
	"readonly": true,
	async read ({ id }) {
	    const start_time	= Date.now();
	    const app			= await this.openstate.get(`app/${id}`);

	    const happ_releases		= await devhub.call( app.devhub_address.dna, "happ_library", "get_happ_releases", {
		"for_happ": app.devhub_address.happ,
	    }, 10_000 );

	    if ( happ_releases.length === 0 ) {
		const happ		= await devhub.call( app.devhub_address.dna, "happ_library", "get_happ", {
		    "id": app.devhub_address.happ,
		}, 10_000 );

		throw new Error(`There are no releases for hApp ${happ.title} (${happ.$id})`);
	    }

	    const latest_happ_release	= happ_releases[0];

	    const manifest		= JSON.parse( JSON.stringify( latest_happ_release.manifest ) )
	    const resources		= {};

	    await Promise.all(
		latest_happ_release.dnas.map( async (dna_ref, i) => {
		    const role		= manifest.roles[i];
		    const id		= new EntryHash( dna_ref.version );
		    const dna_bytes	= await this.openstate.read(`${app.devhub_address.dna}/dnarepo/dna/${id}/package/${dna_ref.role_name}`, { rememberState: false });
		    const rpath		= `${dna_ref.role_name}.dna`;

		    resources[ rpath ]	= dna_bytes;
		    role.dna.bundled	= rpath;
		})
	    );

	    const happ_config		= {
		manifest,
		resources,
	    };
	    const happ_bytes		= pako.gzip( MessagePack.encode( happ_config ) );

	    const duration		= Date.now() - start_time;
	    log.debug("%ss to fetch hApp bundle %s", duration/1000, id );
	    return happ_bytes;
	},
    },
    "App Store - Mere Memory": {
	"path": "appstore/memory/:addr",
	async read ({ addr }) {
	    const bytes		= await appstore.call( "appstore", "mere_memory_api", "retrieve_bytes", new EntryHash( addr ) );
	    return new Uint8Array( bytes );
	},
	async create ( input ) {
	    return await appstore.call("appstore", "mere_memory_api", "save_bytes", input );
	},
	async update () {
	    throw new Error(`Mere Memory records cannot be updated`);
	},
	validation ( data, rejections ) {
	    if ( !data )
		rejections.push(`Missing bytes`);
	    else if ( data.length === 0 )
		rejections.push(`Byte length is 0`);
	},
    },
    "hApp": {
	"path": ":dna/happ/:id",
	async read ({ dna, id }) {
	    assert_holohash( dna, "DnaHash" );
	    assert_holohash( id, "EntryHash" );

	    try {
		return await devhub.call( dna , "happ_library", "get_happ", { id });
	    } catch (err) {
		if ( err.name === "DeserializationError"
		     && err.message.includes("Failed to deserialize to entry type") )
		    throw new TypeError(`Entry ${id} is not the correct entry type; make sure the hash belongs to a hApp entry`);
		else
		    throw err;
	    }
	},
	async create ( input ) {
	    throw new Error(`Use the DevHub App to create hApps`);
	},
	async update ({ id }, changed, intent ) {
	    throw new Error(`Use the DevHub App to update hApps`);
	},
	"permissions": {
	    async writable ( happ ) {
		return false;
	    },
	},
    },
    "Releases for hApp": {
	"path": ":dna/happ/:id/releases",
	"readonly": true,
	async read ({ dna, id }) {
	    assert_holohash( dna, "DnaHash" );
	    assert_holohash( id, "EntryHash" );

	    const list		= await devhub.call( dna, "happ_library", "get_happ_releases", {
		"for_happ": id,
	    });

	    return list;
	},
    },
    "Latest Release for hApp": {
	"path": ":dna/happ/:id/releases/latest",
	"readonly": true,
	async read ({ dna, id }) {
	    const releases		= await this.openstate.read(`${dna}/happ/${id}/releases`);

	    console.log( releases );
	    return releases.reduce( (acc, release, i) => {
		if ( acc === null )
		    return release;

		if ( isNaN(release.version) || isNaN(acc.version) ) {
		    if ( release.last_updated > acc.last_updated )
			return release;
		} else {
		    if ( release.version > acc.version )
			return release;
		}

		return acc;
	    }, null );
	},
    },
    "GUI": {
	"path": ":dna/gui/:id",
	async read ({ dna, id }) {
	    assert_holohash( dna, "DnaHash" );
	    assert_holohash( id, "EntryHash" );

	    try {
		return await devhub.call( dna, "happ_library", "get_gui", { id });
	    } catch (err) {
		if ( err.name === "DeserializationError"
		     && err.message.includes("Failed to deserialize to entry type") )
		    throw new TypeError(`Entry ${id} is not the correct entry type; make sure the hash belongs to a GUI entry`);
		else
		    throw err;
	    }
	},
	adapter ( entity ) {
	    entity.designer		= new AgentPubKey( entity.designer );
	},
	async create ( input ) {
	    throw new Error(`Use the DevHub App to create GUIs`);
	},
	async update ({ id }, changed, intent ) {
	    throw new Error(`Use the DevHub App to update GUIs`);
	},
	"permissions": {
	    async writable ( gui ) {
		return false;
	    },
	},
    },
    "Releases for GUI": {
	"path": ":dna/gui/:id/releases",
	"readonly": true,
	async read ({ dna, id }) {
	    assert_holohash( dna, "DnaHash" );
	    assert_holohash( id, "EntryHash" );

	    const list		= await devhub.call( dna, "happ_library", "get_gui_releases", {
		"for_gui": id,
	    });

	    return list;
	},
    },
    "Latest Release for GUI": {
	"path": ":dna/gui/:id/releases/latest",
	"readonly": true,
	async read ({ dna, id }) {
	    const releases		= await this.openstate.read(`${dna}/gui/${id}/releases`);

	    return releases.reduce( (acc, release, i) => {
		if ( acc === null )
		    return release;

		if ( isNaN(release.version) || isNaN(acc.version) ) {
		    if ( release.last_updated > acc.last_updated )
			return release;
		} else {
		    if ( release.version > acc.version )
			return release;
		}

		return acc;
	    }, null );
	},
    },

    "hApp Release": {
	"path": ":dna/happ/release/:id",
	"readonly": true,
	async read ({ dna, id }, opts ) {
	    return await devhub.call( dna, "happ_library", "get_happ_release", { id });
	},
    },
    "DNA Version": {
	"path": ":dna/dna/version/:id",
	"readonly": true,
	async read ({ dna, id }, opts ) {
	    return await devhub.call( dna, "happ_library", "get_dna_version", { id });
	},
    },
    "DNArepo Memory": {
	"path": ":dna/dnarepo/memory/:addr",
	"readonly": true,
	async read ({ dna, addr }, opts ) {
	    const start_time		= Date.now();
	    const bytes			= await downloadMemory( devhub, dna, addr, "dnarepo" );

	    const duration		= Date.now() - start_time;
	    log.debug("%ss to fetch 'dnarepo' memory %s", duration/1000, addr );

	    return bytes;
	},
    },
    "DNA Package": {
	"path": ":dna/dnarepo/dna/:id/package/:name",
	"readonly": true,
	async read ({ dna, id, name }) {
	    const start_time		= Date.now();
	    const resources		= {};
	    const integrity_zomes	= [];
	    const coordinator_zomes	= [];
	    const dna_version		= await devhub.call( dna, "happ_library", "get_dna_version", { id });

	    await Promise.all([
		...dna_version.integrity_zomes.map( async zome_ref => {
		    const rpath		= `${zome_ref.name}.wasm`;
		    const mm_addr	= new EntryHash( zome_ref.resource );
		    const wasm_bytes	= await this.openstate.read(`${dna}/dnarepo/memory/${mm_addr}`, { rememberState: false });
		    log.info("Zome %s wasm bytes: %s", zome_ref.name, wasm_bytes.length );

		    integrity_zomes.push({
			"name": zome_ref.name,
			"bundled": rpath,
			"hash": null,
		    });
		    resources[ rpath ]	= wasm_bytes;
		}),
		...dna_version.zomes.map( async zome_ref => {
		    const rpath		= `${zome_ref.name}.wasm`;
		    const mm_addr	= new EntryHash( zome_ref.resource );
		    const wasm_bytes	= await this.openstate.read(`${dna}/dnarepo/memory/${mm_addr}`, { rememberState: false });
		    log.info("Zome %s wasm bytes: %s", zome_ref.name, wasm_bytes.length );

		    coordinator_zomes.push({
			"name": zome_ref.name,
			"bundled": rpath,
			"hash": null,
			"dependencies": zome_ref.dependencies.map( name => {
			    return { name };
			}),
		    });
		    resources[ rpath ]	= wasm_bytes;
		}),
	    ]);

	    const dna_config		= {
		"manifest": {
		    "manifest_version": "1",
		    "name": name,
		    "integrity": {
			"origin_time": dna_version.origin_time,
			"network_seed": dna_version.network_seed,
			"properties": dna_version.properties,
			"zomes": integrity_zomes,
		    },
		    "coordinator": {
			"zomes": coordinator_zomes,
		    },
		},
		resources,
	    };

	    const msgpacked_bytes	= MessagePack.encode( dna_config );
	    const gzipped_bytes		= pako.gzip( msgpacked_bytes );

	    const duration		= Date.now() - start_time;
	    log.debug("%ss to fetch DNA bundle %s", duration/1000, id );
	    return gzipped_bytes;
	},
    },
});
