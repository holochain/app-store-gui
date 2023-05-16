const { Logger }			= require('@whi/weblogger');
const log				= new Logger("apps");

const common				= require('./common.js');
const { HoloHash,
	DnaHash,
	EntryHash,
	AgentPubKey }			= holohash;


module.exports = async function () {
    async function create () {
	return {
	    "template": await common.load_html("/templates/apps/create.html"),
	    "data": function() {
		return {
		    "datapath":		`app/${common.randomHex()}`,
		    "happ_hrl":		null,
		    "gui_hrl":		null,
		    "invalid_happ_hrl":	null,
		    "invalid_gui_hrl":	null,
		    "use_official_gui":	true,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( `agent/me/publishers`, "publishers", { "get": true }),

		happ_datapath () {
		    return this.app$.devhub_address.happ
			? `${this.app$.devhub_address.dna}/happ/${this.app$.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app$.devhub_address.happ
			? `${this.app$.devhub_address.dna}/happ/${this.app$.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app$.devhub_address.gui
			? `${this.app$.devhub_address.dna}/gui/${this.app$.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app$.devhub_address.gui
			? `${this.app$.devhub_address.dna}/gui/${this.app$.devhub_address.gui}/releases/latest`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.happ_datapath, "happ" ),
		...common.scopedPathComputed( c => c.happ_release_datapath, "happ_release" ),
		...common.scopedPathComputed( c => c.gui_datapath, "gui" ),
		...common.scopedPathComputed( c => c.gui_release_datapath, "gui_release" ),
	    },
	    "methods": {
		refreshDevHubPaths () {
		    this.readDevHubHapp();
		    this.readDevHubGUI();
		},
		async readDevHubHapp () {
		    if ( this.happ_datapath === this.$openstate.DEADEND )
			return;

		    const happ				= await this.$openstate.read( this.happ_datapath );

		    if ( !this.app$.title )
			this.app$.title		= happ.title;
		    if ( !this.app$.subtitle )
			this.app$.subtitle	= happ.subtitle;
		    if ( !this.app$.description )
			this.app$.description	= happ.description;

		    await this.$openstate.read( this.happ_release_datapath );
		},
		async readDevHubGUI () {
		    if ( this.gui_datapath === this.$openstate.DEADEND )
			return;

		    await this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.gui_release_datapath );
		},
		clearErrors () {
		    this.app_errors.write	= null;
		},
		handleHappHRL ( hrl ) {
		    if ( !hrl ) {
			this.invalid_happ_hrl		= "HRL is required";
			return;
		    }

		    log.info("hApp HRL:", hrl );
		    try {
			let [dna_hash, happ_hash]	= common.parseHRL( hrl );

			this.app$.devhub_address.dna	= dna_hash;
			this.setDevHubHapp( happ_hash );
			this.invalid_happ_hrl		= false;
		    } catch (err) {
			this.invalid_happ_hrl		= String(err);
		    }
		},
		handleGUIHRL ( hrl ) {
		    if ( !hrl ) {
			this.invalid_gui_hrl		= "HRL is required";
			return;
		    }

		    log.info("GUI HRL:", hrl );
		    try {
			let [dna_hash, gui_hash]	= common.parseHRL( hrl );

			if ( String(dna_hash) !== String(this.app$.devhub_address.dna) )
			    throw new Error(`DNA hash from GUI HRL does not match the DNA hash in the hApp HRL`);

			this.setDevHubGUI( gui_hash );
			this.invalid_gui_hrl		= false;
		    } catch (err) {
			this.invalid_gui_hrl		= String(err);
		    }
		},
		setDevHubHapp ( happ_id ) {
		    this.app$.devhub_address.happ	= happ_id;
		    this.readDevHubHapp();
		},
		setDevHubGUI ( gui_id ) {
		    this.app$.devhub_address.gui	= gui_id;
		    this.readDevHubGUI();
		},
		resetDevHubAddress () {
		    this.app$.devhub_address.happ	= null;
		    this.app$.devhub_address.gui	= null;
		    this.gui_hrl			= null;
		    this.use_official_gui		= true;
		},
		async compressIcon () {
		    if ( !this.app$.icon )
			return;
		    const compressed		= await common.compressImage( this.app$.icon, {
			"mimeType": "image/jpeg",
			"maxWidth": 512,
			"maxHeight": 512,
			"convertSize": 50_000,
		    });
		    this.app$.icon		= compressed.result;
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
			? `${this.app.devhub_address.dna}/happ/${this.app.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app?.devhub_address.happ
			? `${this.app.devhub_address.dna}/happ/${this.app.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app?.devhub_address.gui
			? `${this.app.devhub_address.dna}/gui/${this.app.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app?.devhub_address.gui
			? `${this.app.devhub_address.dna}/gui/${this.app.devhub_address.gui}/releases/latest`
			: this.$openstate.DEADEND;
		},
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( c => c.publisher_datapath, "publisher" ),
		...common.scopedPathComputed( c => c.package_datapath, "package" ),
		...common.scopedPathComputed( c => c.happ_datapath, "happ" ),
		...common.scopedPathComputed( c => c.happ_release_datapath, "happ_release" ),
		...common.scopedPathComputed( c => c.gui_datapath, "gui" ),
		...common.scopedPathComputed( c => c.gui_release_datapath, "gui_release" ),

		deprecationModal () {
		    console.log( this.$refs );
		    return new bootstrap.Modal( this.$refs["deprecation-modal"], {
			"backdrop": "static",
			"keyboard": false,
		    });
		},
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
		async confirmDeprecation () {
		    log.normal("Deprecating App %s", this.app.title );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();
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
		    "happ_hrl":		null,
		    "gui_hrl":		null,
		    "invalid_happ_hrl":	null,
		    "invalid_gui_hrl":	null,
		    "use_official_gui":	true,
		};
	    },
	    "computed": {
		happ_datapath () {
		    return this.app$.devhub_address.happ
			? `${this.app$.devhub_address.dna}/happ/${this.app$.devhub_address.happ}`
			: this.$openstate.DEADEND;
		},
		happ_release_datapath () {
		    return this.app$.devhub_address.happ
			? `${this.app$.devhub_address.dna}/happ/${this.app$.devhub_address.happ}/releases/latest`
			: this.$openstate.DEADEND;
		},
		gui_datapath () {
		    return this.app$.devhub_address.gui
			? `${this.app$.devhub_address.dna}/gui/${this.app$.devhub_address.gui}`
			: this.$openstate.DEADEND;
		},
		gui_release_datapath () {
		    return this.app$.devhub_address.gui
			? `${this.app$.devhub_address.dna}/gui/${this.app$.devhub_address.gui}/releases/latest`
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
	    },
	    "methods": {
		refreshDevHubPaths () {
		    this.readDevHubHapp();
		    this.readDevHubGUI();
		},
		async readDevHubHapp () {
		    await this.$openstate.read( this.happ_datapath );
		    await this.$openstate.read( this.happ_release_datapath );
		},
		async readDevHubGUI () {
		    await this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.gui_release_datapath );
		},
		handleHappHRL ( hrl ) {
		    if ( !hrl ) {
			this.invalid_happ_hrl		= "HRL is required";
			return;
		    }

		    log.info("hApp HRL:", hrl );
		    try {
			let [dna_hash, happ_hash]	= common.parseHRL( hrl );

			this.app$.devhub_address.dna	= dna_hash;
			this.setDevHubHapp( happ_hash );
			this.invalid_happ_hrl		= false;
		    } catch (err) {
			this.invalid_happ_hrl		= String(err);
		    }
		},
		handleGUIHRL ( hrl ) {
		    if ( !hrl ) {
			this.invalid_gui_hrl		= "HRL is required";
			return;
		    }

		    log.info("GUI HRL:", hrl );
		    try {
			let [dna_hash, gui_hash]	= common.parseHRL( hrl );

			if ( String(dna_hash) !== String(this.app$.devhub_address.dna) )
			    throw new Error(`DNA hash from GUI HRL does not match the DNA hash in the hApp HRL`);

			this.setDevHubGUI( gui_hash );
			this.invalid_gui_hrl		= false;
		    } catch (err) {
			this.invalid_gui_hrl		= String(err);
		    }
		},
		setDevHubHapp ( happ_id ) {
		    this.app$.devhub_address.happ	= happ_id;
		    this.readDevHubHapp();
		},
		setDevHubGUI ( gui_id ) {
		    this.app$.devhub_address.gui	= gui_id;
		    this.readDevHubGUI();
		},
		resetDevHubAddress () {
		    this.app$.devhub_address.happ	= null;
		    this.app$.devhub_address.gui	= null;
		    this.gui_hrl			= null;
		    this.use_official_gui		= true;
		},
		async compressIcon () {
		    if ( !this.new_icon )
			return;
		    const compressed		= await common.compressImage( this.new_icon, {
			"mimeType": "image/jpeg",
			"maxWidth": 512,
			"maxHeight": 512,
			"convertSize": 50_000,
		    });
		    this.new_icon		= compressed.result;
		},
		async update () {
		    console.log("Writing", this.app$ );
		    if ( this.new_icon )
			this.app$.icon		= this.new_icon;
		    await this.$openstate.write( this.datapath );

		    this.new_icon		= null;
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
