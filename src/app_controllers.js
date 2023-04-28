const { Logger }			= require('@whi/weblogger');
const log				= new Logger("apps");

const common				= require('./common.js');
const { HoloHash,
	DnaHash,
	AgentPubKey }			= holohash;


module.exports = async function () {
    async function create () {
	return {
	    "template": await common.load_html("/templates/apps/create.html"),
	    "data": function() {
		return {
		    "use_official_gui":	true,
		    "invalid_dna_hash":	null,
		    "datapath":		`app/${common.randomHex()}`,
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
		    if ( this.happ_datapath !== this.$openstate.DEADEND ) {
			this.$openstate.read( this.happ_datapath ).then( () => {
			    this.$openstate.read( this.happ_release_datapath );
			});
		    }
		    if ( this.gui_datapath !== this.$openstate.DEADEND ) {
			this.$openstate.read( this.gui_datapath ).then( () => {
			    this.$openstate.read( this.gui_release_datapath );
			});
		    }
		},
		clearErrors () {
		    this.app_errors.write	= null;
		},
		checkDevHubDNA ( dna_hash ) {
		    try {
			new DnaHash( dna_hash );
			this.invalid_dna_hash		= true;

			this.refreshDevHubPaths();
		    } catch (err) {
			this.invalid_dna_hash		= err.name === "BadPrefixError"
			    ? `Invalid DNA hash.  A DNA hash will start with "uhC0k" and will be 53 characters long.`
			    : `Holo Hash Error: [${err.name}] ${err.message}`;
		    }
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
		    "invalid_dna_hash":	null,
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
		async readDevHubHapp () {
		    await this.$openstate.read( this.happ_datapath );
		    await this.$openstate.read( this.happ_release_datapath );
		},
		async readDevHubGUI () {
		    await this.$openstate.read( this.gui_datapath );
		    await this.$openstate.read( this.gui_release_datapath );
		},
		checkDevHubDNA ( dna_hash ) {
		    try {
			new DnaHash( dna_hash );
			this.invalid_dna_hash		= true;

			this.$openstate.read( this.happ_datapath ).then( happ => {
			    this.$openstate.read( this.happ_release_datapath );
			});
		    } catch (err) {
			this.invalid_dna_hash		= err.name === "BadPrefixError"
			    ? `Invalid DNA hash.  A DNA hash will start with "uhC0k" and will be 53 characters long.`
			    : `Holo Hash Error: [${err.name}] ${err.message}`;
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
