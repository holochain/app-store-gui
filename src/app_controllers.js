const { Logger }			= require('@whi/weblogger');
const log				= new Logger("apps");

const common				= require('./common.js');


module.exports = async function ( [appstore] ) {
    async function create () {
	return {
	    "template": await common.load_html("/templates/apps/create.html"),
	    "data": function() {
		return {
		    "datapath":		`app/${common.randomHex()}`,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( `agent/me/publishers`, "publishers", { "get": true }),
	    },
	    async created () {
	    },
	    "methods": {
		clearErrors () {
		    this.app_errors.write	= null;
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
		this.mustGet(async () => {
		    this.$openstate.read( this.publisher_datapath );
		    await this.$openstate.read( this.datapath );
		});
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( c => c.publisher_datapath, "publisher" ),
		...common.scopedPathComputed( c => c.package_datapath, "package" ),
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		    this.$openstate.read( this.publisher_datapath );
		},
		async downloadApp () {
		    if ( this.$package.reading )
			return;

		    const bytes			= await this.$openstate.read( this.package_datapath, {
			"rememberState": false,
		    });

		    console.log("App pacakge:", bytes );
		    this.download( `${this.app.name}.webhapp`, bytes );
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
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "app" ),
		...common.scopedPathComputed( `agent/me/publishers`, "publishers", { "get": true }),
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
	    },
	    "methods": {
		async update () {
		    try {
			console.log("Writing", this.app$ );
			if ( this.new_icon ) {
			    log.normal("Creating new icon memory of size %s", this.new_icon.length );
			    this.app$.icon	= await this.createMereMemoryEntry( this.new_icon );
			    log.info("New icon memory address: %s", this.app$.icon );
			}
			await this.$openstate.write( this.datapath );

			await this.$openstate.read("apps");

			this.$router.push( "/apps/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update app (%s):", String(this.id), err );
			this.error	= err;
		    }
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
