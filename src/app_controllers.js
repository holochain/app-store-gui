const { Logger }			= require('@whi/weblogger');
const log				= new Logger("apps");

const common				= require('./common.js');
const { HoloHash,
	AgentPubKey }			= holohash;


module.exports = async function () {
    async function create () {
	return {
	    "template": await common.load_html("/templates/apps/create.html"),
	    "data": function() {
		return {
		    "use_official_gui":	true,
		    "datapath":		`app/${common.randomHex()}`,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( `agent/me/publishers`, "publishers", { "get": true }),

		happ_datapath () {
		    return this.app$.devhub_address.happ
			? `happ/${this.app$.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app$.devhub_address.happ
			? `happ/${this.app$.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app$.devhub_address.gui
			? `gui/${this.app$.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app$.devhub_address.gui
			? `gui/${this.app$.devhub_address.gui}/releases/latest`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.happ_datapath, "happ" ),
		...common.scopedPathComputed( c => c.happ_release_datapath, "happ_release" ),
		...common.scopedPathComputed( c => c.gui_datapath, "gui" ),
		...common.scopedPathComputed( c => c.gui_release_datapath, "gui_release" ),
	    },
	    async created () {
		this.app$.devhub_address.dna	= await this.$openstate.get(`dna/alias/happs`);
	    },
	    "methods": {
		clearErrors () {
		    this.app_errors.write	= null;
		},
		setDevHubHapp ( happ_id ) {
		    this.app$.devhub_address.happ	= happ_id;
		    this.$openstate.read( this.happ_datapath ).then( happ => {
			this.$openstate.read( this.happ_release_datapath );
		    });
		},
		setDevHubGUI ( gui_id ) {
		    this.app$.devhub_address.gui	= gui_id;
		    this.$openstate.read( this.gui_datapath ).then( happ => {
			this.$openstate.read( this.gui_release_datapath );
		    });;
		},
		async create () {
		    console.log("Writing", this.app$ );
		    await this.$openstate.write( this.datapath );

		    const new_id		= this.app.$id;
		    this.$openstate.purge( this.datapath );

		    await this.$openstate.read("apps");

		    this.$router.push( "/apps/" + new_id );
		},

		actionErrors () {
		    const errors		= [];
		    errors.push( ...this.app_rejections );

		    const error			= this.app_errors.write;
		    if ( error ) {
			const name		= error.name;
			if ( name === "RibosomeDeserializeError" ) {
			    const message	= error.message.split('[')[0];
			    const json		= this.$debug( error.data );
			    errors.push( `${name}: ${message}\n\n${json}` );
			}
			else
			    errors.push( this.app_errors.write );
		    }

		    return errors;
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/apps/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`app/${id}`,
		    "publisher_datapath":	`app/${id}/publisher`,
		    "package_datapath":		`app/${id}/package`,
		};
	    },
	    async created () {
		await this.mustGet(async () => {
		    this.$openstate.read( this.publisher_datapath );
		    await this.$openstate.read( this.datapath );
		});

		this.readDevHubHapp();
		if ( this.app.devhub_address.gui )
		    this.readDevHubGUI();
	    },
	    "computed": {
		happ_datapath () {
		    return this.app?.devhub_address.happ
			? `happ/${this.app.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app?.devhub_address.happ
			? `happ/${this.app$.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app?.devhub_address.gui
			? `gui/${this.app.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app?.devhub_address.gui
			? `gui/${this.app$.devhub_address.gui}/releases/latest`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( c => c.publisher_datapath, "publisher" ),
		...common.scopedPathComputed( c => c.package_datapath, "package" ),
		...common.scopedPathComputed( c => c.happ_datapath, "happ" ),
		...common.scopedPathComputed( c => c.happ_release_datapath, "happ_release" ),
		...common.scopedPathComputed( c => c.gui_datapath, "gui" ),
		...common.scopedPathComputed( c => c.gui_release_datapath, "gui_release" ),
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.publisher_datapath );
		},
		async readDevHubHapp () {
		    await this.$openstate.read( this.happ_datapath );
		    await this.$openstate.read( this.happ_release_datapath );
		},
		async readDevHubGUI () {
		    await this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.gui_release_datapath );
		},
		async downloadApp () {
		    if ( this.$package.reading )
			return;

		    const bytes			= await this.$openstate.read( this.package_datapath, {
			"rememberState": false,
		    });

		    console.log("App pacakge:", bytes );
		    this.download( `${this.app.title}.webhapp`, bytes );
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/apps/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":		`app/${id}`,
		    "new_icon":		null,
		    "use_official_gui":	true,
		};
	    },
	    "computed": {
		happ_datapath () {
		    return this.app$.devhub_address.happ
			? `happ/${this.app$.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app$.devhub_address.happ
			? `happ/${this.app$.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app$.devhub_address.gui
			? `gui/${this.app$.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app$.devhub_address.gui
			? `gui/${this.app$.devhub_address.gui}/releases/latest`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( `agent/me/publishers`, "publishers", { "get": true }),
		...common.scopedPathComputed( c => c.happ_datapath, "happ" ),
		...common.scopedPathComputed( c => c.happ_release_datapath, "happ_release" ),
		...common.scopedPathComputed( c => c.gui_datapath, "gui" ),
		...common.scopedPathComputed( c => c.gui_release_datapath, "gui_release" ),
	    },
	    async created () {
		await this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );

		    this.use_official_gui	= !this.app$.devhub_address.gui;
		});

		this.readDevHubHapp();
		if ( this.app$.devhub_address.gui )
		    this.readDevHubGUI();

		this.app$.devhub_address.dna	= await this.$openstate.get(`dna/alias/happs`);
	    },
	    "methods": {
		async readDevHubHapp () {
		    await this.$openstate.read( this.happ_datapath );
		    await this.$openstate.read( this.happ_release_datapath );
		},
		async readDevHubGUI () {
		    await this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.gui_release_datapath );
		},
		setDevHubHapp ( happ_id ) {
		    this.app$.devhub_address.happ	= happ_id;
		    this.readDevHubHapp();
		},
		setDevHubGUI ( gui_id ) {
		    this.app$.devhub_address.gui	= gui_id;
		    this.readDevHubGUI();
		},
		async update () {
		    console.log("Writing", this.app$ );
		    if ( this.new_icon ) {
			log.normal("Creating new icon memory of size %s", this.new_icon.length );
			this.app$.icon	= await this.createMereMemoryEntry( this.new_icon );
			log.info("New icon memory address: %s", this.app$.icon );
		    }
		    await this.$openstate.write( this.datapath );

		    await this.$openstate.read("apps");

		    this.$router.push( "/apps/" + this.id );
		},

		actionErrors () {
		    const errors		= [];
		    errors.push( ...this.app_rejections );

		    const error			= this.app_errors.write;
		    if ( error ) {
			const name		= error.name;
			if ( name === "RibosomeDeserializeError" ) {
			    const message	= error.message.split('[')[0];
			    const json		= this.$debug( error.data );
			    errors.push( `${name}: ${message}\n\n${json}` );
			}
			else
			    errors.push( this.app_errors.write );
		    }

		    return errors;
		},
	    },
	};
    };

    return {
	create,
	update,
	single,
    };
};
