const { Logger }			= require('@whi/weblogger');
const log				= new Logger("appstore/openstate");

const common				= require('../common.js');
const { HoloHash,
	HoloHashError,
	EntryHash,
	ActionHash,
	DnaHash,
	AgentPubKey }			= holohash;

module.exports				= appstore => ({
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
	    if ( id === "me" )
		return await appstore.call("appstore", "appstore_api", "get_my_publishers");

	    const list			= await appstore.call("appstore", "appstore_api", "get_publishers_for_agent", {
		"for_agent": id,
	    });

	    for ( let publisher of list ) {
		const path		= `publisher/${publisher.$id}`;
		this.openstate.state[path]	= publisher;
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
	    };
	},
	async create ( input ) {
	    const publisher		= await appstore.call("appstore", "appstore_api", "create_publisher", input );

	    this.openstate.state[`publisher/${publisher.$id}`] = publisher;

	    return publisher;
	},
	toMutable ({ name, location, website, email, icon }) {
	    return { name, location, website, email, icon };
	},
	async update ({ id }, changed, intent ) {
	    return await appstore.call("appstore", "appstore_api", "update_publisher", {
		"base": this.state.$action,
		"properties": changed,
	    });
	},
	async delete () {
	    throw new Error(`Publishers cannot be deleted`);
	},
	"permissions": {
	    async writable ( publisher ) {
		const agent_info	= await this.get("agent/me");
		return common.hashesAreEqual( publisher.author, agent_info.pubkey.initial );
	    },
	},
	validation ( data, rejections, intent ) {
	    if ( typeof data.name !== "string" )
		rejections.push(`Name is required`);

	    if ( !data.location )
		rejections.push(`Location is required`);
	    else {
		if ( typeof data.location.country !== "string" )
		    rejections.push(`Country is required`);
		if ( typeof data.location.region !== "string" )
		    rejections.push(`Region is required`);
		if ( typeof data.location.city !== "string" )
		    rejections.push(`City is required`);
	    }

	    if ( !data.website )
		rejections.push(`Website is required`);
	    else {
		if ( typeof data.website.url !== "string" )
		    rejections.push(`Website is required`);
	    }

	    if ( data.icon === undefined )
		rejections.push(`Icon is required`);
	    else if ( !(data.icon instanceof Uint8Array) ) {
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
	    };
	},
	async create ( input ) {
	    const app		= await appstore.call("appstore", "appstore_api", "create_app", input );

	    this.openstate.state[`app/${app.$id}`] = app;

	    return app;
	},
	toMutable ({ name, description, icon, publisher, devhub_address }) {
	    return {
		name, description, icon,
		"publisher":	String( publisher ),
		"devhub_address": {
		    "dna":	String( devhub_address.dna ),
		    "happ":	String( devhub_address.happ ),
		    "gui":	devhub_address.gui ? String( devhub_address.gui ) : devhub_address.gui,
		},
	    };
	},
	async update ({ id }, changed, intent ) {
	    return await appstore.call("appstore", "appstore_api", "update_app", {
		"base": this.state.$action,
		"properties": changed,
	    });
	},
	async delete () {
	    throw new Error(`Apps cannot be deleted`);
	},
	"permissions": {
	    async writable ( app ) {
		const agent_info	= await this.get("agent/me");
		return common.hashesAreEqual( app.author, agent_info.pubkey.initial );
	    },
	},
	validation ( data, rejections, intent ) {
	    if ( data.icon === undefined )
		rejections.push(`Icon is required`);
	    else if ( !(data.icon instanceof Uint8Array) ) {
		try {
		    new EntryHash( data.icon );
		} catch (err) {
		    if ( err instanceof HoloHashError )
			rejections.push(`Icon must be an EntryHash or image bytes (Uint8Array)`);
		}
	    }

	    if ( typeof data.name !== "string" || data.name.trim() === "" )
		rejections.push(`Name is required`);

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
		if ( typeof data.devhub_address.dna !== "string" )
		    rejections.push(`DevHub Address DNA Hash is required`);
		if ( typeof data.devhub_address.happ !== "string" )
		    rejections.push(`DevHub Address hApp ID is required`);
		if ( data.devhub_address.gui && typeof data.devhub_address.gui !== "string" )
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
	    const list				= await appstore.call("appstore", "appstore_api", "get_registered_hosts", dna );

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
	    const list				= await appstore.call("appstore", "appstore_api", "get_hosts_for_zome_function", {
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
	    async function portal_call ( dna, zome, func, payload, timeout ) {
		const available_host		= await this.openstate.get(`devhub/hosts/${dna}/${zome}/${func}/any`);
		const dna_hash			= await appstore.call("appstore", "appstore_api", "get_dna_hash", dna );
		const call_details		= {
		    "dna": dna_hash,
		    "zome": zome,
		    "function": func,
		    "payload": payload,
		};
		return await appstore.call("portal", "portal_api", "custom_remote_call", {
		    "host": available_host.author,
		    "call": call_details,
		}, timeout );
	    }

	    const app				= await this.openstate.get(`app/${id}`);

	    const happ_releases			= await portal_call( "happs", "happ_library", "get_happ_releases", {
		"for_happ": app.devhub_address.happ,
	    }, 10_000 );

	    if ( happ_releases.length === 0 ) {
		const happ			= await portal_call( "happs", "happ_library", "get_happ", {
		    "id": app.devhub_address.happ,
		}, 10_000 );

		throw new Error(`There are no releases for hApp ${happ.title} (${happ.$id})`);
	    }

	    const latest_happ_release		= happ_releases[0];

	    if ( !(app.devhub_address.gui || latest_happ_release.official_gui) )
		throw new Error(`No Official GUI for hApp Release '${latest_happ_release.name}' (${latest_happ_release.$id})`);

	    const gui_id			= app.devhub_address.gui || latest_happ_release.official_gui;
	    const gui_releases			= await portal_call( "happs", "happ_library", "get_gui_releases", {
		"for_gui": gui_id,
	    }, 10_000 );

	    if ( gui_releases.length === 0 ) {
		const gui			= await portal_call( "happs", "happ_library", "get_gui", {
		    "id": gui_id,
		}, 10_000 );

		throw new Error(`There are no releases for GUI '${gui.name}' (${gui.$id})`);
	    }

	    const latest_gui_release		= gui_releases[0];

	    const bytes				= await portal_call( "happs", "happ_library", "get_webhapp_package", {
		"name": app.name,
		"happ_release_id": latest_happ_release.$id,
		"gui_release_id": latest_gui_release.$id,
	    }, 60_000 );

	    return new Uint8Array( bytes );
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
});
