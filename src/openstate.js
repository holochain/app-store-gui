const { Logger }			= require('@whi/weblogger');
const log				= new Logger("openstate");

const OpenState				= require('openstate');
const common				= require('./common.js');

const { reactive }			= Vue;
const { HoloHash,
	EntryHash,
	ActionHash,
	AgentPubKey }			= holohash;
const { EntityArchitect }		= CruxPayloadParser;
const { Entity }			= EntityArchitect;

module.exports = async function ([ appstore, devhub ]) {
    const openstate			= new OpenState.create({
	reactive,
	"globalDefaults": {
	    adapter ( value ) {
		if ( value instanceof Entity ) {
		    if ( value.published_at )
			value.published_at	= new Date( value.published_at );
		    if ( value.last_updated )
			value.last_updated	= new Date( value.last_updated );
		}
	    },
	    toMutable ( value ) {
		if ( value instanceof Entity ) {
		    value		= value.toJSON().content;
		    value.published_at	= value.published_at.toISOString();
		    value.last_updated	= value.last_updated.toISOString();
		}
		return value;
	    },
	},
    });

    openstate.addHandlers({
	"Agent": {
	    "path": "agent/:id",
	    "readonly": true,
	    async read ({ id }) {
		if ( id === "me" )
		    return await devhub.call("dnarepo", "dna_library", "whoami");

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

		return await appstore.call("appstore", "appstore_api", "get_publishers_for_agent", {
		    "for_agent": id,
		});
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
	"DNA's Mere Memory": {
	    "path": ":dna/mere_memory/:addr",
	    async read ({ dna, addr }) {
		const bytes		= await devhub.call( dna, "mere_memory", "retrieve_bytes", new EntryHash( addr ) );
		return new Uint8Array( bytes );
	    },
	    adapter ( bytes ) {
		return new Uint8Array( bytes );
	    },
	    async create ( input ) {
		const memory		= await devhub.call("web_assets", "mere_memory", "save_bytes", input );

		this.openstate.state[`webasset/${webasset.$id}`] = webasset;

		return webasset;
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
	    defaultMutable () {
		return {
		};
	    },
	    async create ( input ) {
		const publisher		= await appstore.call("appstore", "appstore_api", "create_publisher", input );

		this.openstate.state[`publisher/${publisher.$id}`] = publisher;

		return publisher;
	    },
	    toMutable ({ name, location, website }) {
		return { name, location, website };
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
	    defaultMutable () {
		return {
		};
	    },
	    async create ( input ) {
		const app		= await appstore.call("appstore", "appstore_api", "create_app", input );

		this.openstate.state[`app/${app.$id}`] = app;

		return app;
	    },
	    toMutable ({ name, description, publisher, devhub_address }) {
		return { name, description, publisher, devhub_address };
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
		if ( typeof data.name !== "string" )
		    rejections.push(`Name is required`);
	    },
	},
    });

    return openstate;
};
