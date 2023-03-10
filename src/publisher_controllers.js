const { Logger }			= require('@whi/weblogger');
const log				= new Logger("publishers");

const common				= require('./common.js');
const countries				= require('./countries.js');


module.exports = async function ( [appstore] ) {

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
		async create () {
		    console.log("Writing", this.publisher$ );
		    await this.$openstate.write( this.datapath );

		    const new_id		= this.publisher.$id;
		    this.$openstate.purge( this.datapath );

		    await this.$openstate.read("publishers");

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
	    },
	    "methods": {
		refresh () {
		    this.$openstate.read( this.datapath );
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
		async update () {
		    try {
			console.log("Writing", this.publisher$ );
			if ( this.new_icon ) {
			    log.normal("Creating new icon memory of size %s", this.new_icon.length );
			    this.publisher$.icon	= await this.createMereMemoryEntry( this.new_icon );
			    log.info("New icon memory address: %s", this.publisher$.icon );
			}
			await this.$openstate.write( this.datapath );

			await this.$openstate.read("publishers");

			this.$router.push( "/publishers/" + this.id );
		    } catch ( err ) {
			log.error("Failed to update publisher (%s):", String(this.id), err );
			this.error	= err;
		    }
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
