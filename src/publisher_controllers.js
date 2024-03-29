const { Logger }			= require('@whi/weblogger');
const log				= new Logger("publishers");

const common				= require('./common.js');
const countries				= require('./countries.js');


module.exports = async function () {

    async function create () {
	return {
	    "template": await common.load_html("/templates/publishers/create.html"),
	    "data": function() {
		return {
		    "datapath":		`publisher/${common.randomHex()}`,
		    countries,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "publisher" ),
	    },
	    "methods": {
		async compressIcon () {
		    if ( !this.publisher$.icon )
			return;

		    if ( this.publisher$.icon.file.name.endsWith(".svg") ) {
			this.publisher$.metadata.icon_mime_type = "image/svg+xml";
			return;
		    }

		    delete this.publisher$.metadata.icon_mime_type;

		    const compressed		= await common.compressImage( this.publisher$.icon, {
			"mimeType": "image/jpeg",
			"maxWidth": 512,
			"maxHeight": 512,
			"convertSize": 50_000,
		    });
		    this.publisher$.icon	= compressed.result;
		},
		async create () {
		    console.log("Writing", this.publisher$ );
		    await this.$openstate.write( this.datapath );

		    const new_id		= this.publisher.$id;
		    this.$openstate.purge( this.datapath );

		    await this.$openstate.read("publishers");
		    await this.$openstate.read("agent/me/publishers");

		    this.$router.push( "/publishers/" + new_id );
		},

		actionErrors () {
		    const errors		= [];
		    errors.push( ...this.publisher_rejections );

		    const error			= this.publisher_errors.write;
		    if ( error ) {
			const name		= error.name;
			if ( name === "RibosomeDeserializeError" ) {
			    const message	= error.message.split('[')[0];
			    const json		= this.$debug( error.data );
			    errors.push( `${name}: ${message}\n\n${json}` );
			}
			else
			    errors.push( this.publisher_errors.write );
		    }

		    return errors;
		},
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/publishers/single.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":			`publisher/${id}`,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.read( this.datapath );
		});
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "publisher" ),

		deprecationModal () {
		    return new bootstrap.Modal( this.$refs["deprecation-modal"], {
			"backdrop": "static",
			"keyboard": false,
		    });
		},
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
		},
		async confirmDeprecation () {
		    log.normal("Deprecating Publisher %s", this.publisher.name );
		    await this.$openstate.write( this.datapath, "deprecation" );

		    this.deprecationModal.hide();
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/publishers/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    countries,
		    "datapath":		`publisher/${id}`,
		    "new_icon":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "publisher" ),
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
	    },
	    "methods": {
		async compressIcon () {
		    if ( !this.new_icon )
			return;

		    if ( this.new_icon.file?.name.endsWith(".svg") )
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
		    console.log("Writing", this.publisher$ );

		    let current_icon_bytes	= this.$openstate.state[`appstore/memory/${this.publisher$.icon}`];
		    if ( this.new_icon &&
			 !common.equalUint8Arrays( this.new_icon, current_icon_bytes ) ) {
			this.publisher$.icon	= this.new_icon;

			if ( this.new_icon.file?.name.endsWith(".svg") )
			    this.publisher$.metadata.icon_mime_type = "image/svg+xml";
			else
			    delete this.publisher$.metadata.icon_mime_type;
		    }

		    await this.$openstate.write( this.datapath );

		    this.new_icon		= null;
		    await this.$openstate.read("publishers");

		    this.$router.push( "/publishers/" + this.id );
		},

		actionErrors () {
		    const errors		= [];
		    errors.push( ...this.publisher_rejections );

		    const error			= this.publisher_errors.write;
		    if ( error ) {
			const name		= error.name;
			if ( name === "RibosomeDeserializeError" ) {
			    const message	= error.message.split('[')[0];
			    const json		= this.$debug( error.data );
			    errors.push( `${name}: ${message}\n\n${json}` );
			}
			else
			    errors.push( this.publisher_errors.write );
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
