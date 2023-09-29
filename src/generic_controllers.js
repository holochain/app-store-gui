const { Logger }			= require('@whi/weblogger');
const log				= new Logger("generic");

const common				= require('./common.js');


module.exports = async function () {

    async function main () {
	return {
	    "template": await common.load_html("/templates/main.html"),
	    "data": function() {
		return {
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.refresh();
		});
	    },
	    "computed": {
		...common.scopedPathComputed( `apps`, "apps" ),
		...common.scopedPathComputed( `apps/removed`, "removed_apps" ),
	    },
	    "methods": {
		async refresh () {
		    this.$openstate.read( "apps/removed" );
		    await this.$openstate.read( "apps" );
		},
	    },
	};
    };

    async function create () {
	return {
	    "template": await common.load_html("/templates/profiles/create.html"),
	    "data": function() {
		return {
		};
	    },
	    "computed": {
	    },
	    "methods": {
	    },
	};
    };

    async function single () {
	return {
	    "template": await common.load_html("/templates/profiles/single.html"),
	    "data": function() {
		return {
		    "publishers_datapath":	`agent/me/publishers`,
		    "apps_datapath":		`agent/me/apps`,
		};
	    },
	    async created () {
		this.mustGet( this.refresh );
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.publishers_datapath, "publishers" ),
		...common.scopedPathComputed( c => c.apps_datapath, "apps" ),

		agent () {
		    return this.$root.agent?.pubkey.initial;
		},
	    },
	    "methods": {
		async refresh () {
		    await Promise.all([
			this.$openstate.read( this.publishers_datapath ),
			this.$openstate.read( this.apps_datapath ),
		    ]);
		},
	    },
	};
    };

    async function update () {
	return {
	    "template": await common.load_html("/templates/profiles/update.html"),
	    "data": function() {
		const id		= this.getPathId("id");

		return {
		    id,
		    "datapath":		`profile/${id}`,
		    "new_icon":		null,
		};
	    },
	    "computed": {
		...common.scopedPathComputed( c => c.datapath, "profile" ),
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.$openstate.get( this.datapath );
		});
	    },
	    "methods": {
	    },
	};
    };

    return {
	main,
	create,
	update,
	single,
    };
};
