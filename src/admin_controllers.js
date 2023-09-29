const { Logger }			= require('@whi/weblogger');
const log				= new Logger("admin");

const common				= require('./common.js');


module.exports = async function () {

    async function dashboard () {
	return {
	    "template": await common.load_html("/templates/admin.html"),
	    "data": function() {
		return {
		    "new_admin": null,
		    "new_member": null,
		};
	    },
	    async created () {
		this.mustGet(async () => {
		    await this.refresh();
		});
	    },
	    "computed": {
		...common.scopedPathComputed( `viewpoint/group`, "group" ),
	    },
	    "methods": {
		async refresh () {
		    await this.$openstate.read("viewpoint/group");
		},
		async reset () {
		    await this.$openstate.resetMutable("viewpoint/group");
		},
		async update () {
		    await this.$openstate.write("viewpoint/group");
		},
	    },
	};
    };

    return {
	dashboard
    };
};
