const { Logger }			= require('@whi/weblogger');
const log				= new Logger("main");

const json				= require('@whi/json');
const { invoke }			= require('@tauri-apps/api/tauri');
const { EntityArchitect,
	...crux }			= CruxPayloadParser;
const { AgentPubKey }			= holohash;

Error.stackTraceLimit = Infinity;


const HISTORY_PUSH_STATE		= window.localStorage.getItem("PUSH_STATE");
// log.level.trace && crux.log.setLevel("trace");

const client_init			= require('./client.js');
const openstate_init			= require('./openstate.js');
const common				= require('./common.js');
const filters				= require('./filters.js');

const generics_init			= require('./generic_controllers.js');
const publishers_init			= require('./publisher_controllers.js');
const apps_init				= require('./app_controllers.js');


const HOST_VALUE			= localStorage.getItem("APP_HOST");
const PORT_VALUE			= localStorage.getItem("APP_PORT");
const APP_PORT				= parseInt( PORT_VALUE ) || 44001;
const APP_HOST				= HOST_VALUE || "127.0.0.1";
const CONDUCTOR_URI			= `${APP_HOST}:${APP_PORT}`;
const APP_ID				= localStorage.getItem("APP_ID") || "app-store";


if ( isNaN( APP_PORT ) )
    throw new Error(`Invalid 'APP_PORT' (${PORT_VALUE}); run 'localStorage.setItem( "APP_PORT", "<port number>" );`);


async function setup_clients() {
    try {
	const launcher_config		= window.__HC_LAUNCHER_ENV__;

	if ( !launcher_config )
	    throw new TypeError(`No launcher config @ window.__HC_LAUNCHER_ENV__`);

	const [appstore]		= await client_init(
	    `${APP_HOST}:${launcher_config.APP_INTERFACE_PORT}`,
	    launcher_config.INSTALLED_APP_ID
	);

	appstore.setSigningHandler( async zomeCallUnsigned => {
	    zomeCallUnsigned.provenance	= Array.from( zomeCallUnsigned.provenance );
	    zomeCallUnsigned.cell_id	= [
		Array.from( zomeCallUnsigned.cell_id[0] ),
		Array.from( zomeCallUnsigned.cell_id[1] ),
	    ];
	    zomeCallUnsigned.payload	= Array.from( zomeCallUnsigned.payload );
	    zomeCallUnsigned.nonce	= Array.from( zomeCallUnsigned.nonce );

	    const signedZomeCall	= await invoke("sign_zome_call", {
		zomeCallUnsigned,
	    });

	    signedZomeCall.cap_secret	= null;
	    signedZomeCall.provenance	= Uint8Array.from( signedZomeCall.provenance );
	    signedZomeCall.cell_id	= [
		Uint8Array.from( signedZomeCall.cell_id[0] ),
		Uint8Array.from( signedZomeCall.cell_id[1] ),
	    ];
	    signedZomeCall.payload	= Uint8Array.from( signedZomeCall.payload );
	    signedZomeCall.signature	= Uint8Array.from( signedZomeCall.signature || [] );
	    signedZomeCall.nonce	= Uint8Array.from( signedZomeCall.nonce );

	    log.trace("Signed request input:", signedZomeCall );
	    return signedZomeCall;
	});

	return [appstore];
    } catch (err) {
	log.warn("Using hard-coded configuration because launcher config produced error: %s", err.toString() );
    }

    return await client_init( CONDUCTOR_URI, APP_ID );
}


(async function(global) {
    const [appstore]			= await setup_clients();

    log.warn("Pre-load WASMs with 30s timeout");
    await appstore.call("appstore", "appstore_api", "whoami", null, 30_000 );

    const openstate			= await openstate_init([ appstore ]);
    const generic_controllers		= await generics_init();
    const publisher_controllers		= await publishers_init();
    const app_controllers		= await apps_init();

    window.appstore_client		= appstore;
    window.openstate			= openstate;

    const route_components		= [
	[ "/",						generic_controllers.main,		"Main" ],
	[ "/profile",					generic_controllers.single,		"Profile" ],

	[ "/publishers",				publisher_controllers.list,		"All publishers" ],
	[ "/publishers/new",				publisher_controllers.create,		"Add publisher" ],
	[ "/publishers/:id",				publisher_controllers.single,		"publisher Info" ],
	[ "/publishers/:id/update",			publisher_controllers.update,		"Edit publisher" ],

	[ "/apps",					app_controllers.list,			"All Apps" ],
	[ "/apps/new",					app_controllers.create,			"Add App" ],
	[ "/apps/:id",					app_controllers.single,			"App Info" ],
	[ "/apps/:id/update",				app_controllers.update,			"Edit App" ],
    ];

    const breadcrumb_mapping		= {};
    const routes			= [];
    for (let [ path, component, name ] of route_components ) {
	log.trace("Adding route path: %s", path );

	if ( /\/(:[A-Za-z-_+]+)/.test( path ) ) {
	    const re			= "^" + path.replace(/\/(:[A-Za-z-_+]+)/g, "/[A-Za-z0-9-_+]+") + "$";
	    breadcrumb_mapping[ re ]	= name;
	}
	else
	    breadcrumb_mapping[ path ]	= name;

	routes.push({
	    path,
	    component,
	});
    }
    log.normal("Configured %s routes for App", routes.length );

    const router			= VueRouter.createRouter({
	"history": HISTORY_PUSH_STATE === "true"
	    ? VueRouter.createWebHistory()
	    : VueRouter.createWebHashHistory(),
	routes,
	"linkActiveClass": "parent-active",
	"linkExactActiveClass": "active",
    });

    let $root;
    const app				= Vue.createApp({
	data () {
	    return {
		"show_copied_message": false,
		"status_view_data": null,
		"status_view_html": null,
		"errors": [],
	    };
	},
	"computed": {
	    ...common.scopedPathComputed( "agent/me", "agent" ),
	},
	async created () {
	    $root			= this;
	    const { TimeoutError }	= await HolochainClient;

	    this.$router.afterEach( (to, from, failure) => {
		if ( failure instanceof Error )
		    return log.error("Failed to Navigate:", failure.message );

		log.normal("Navigated to:", to.path, from.path );

		if ( to.matched.length === 0 )
		    return this.showStatusView( 404 );

		this.showStatusView( false );
	    });

	    try {
		await this.$openstate.get("agent/me");
	    } catch (err) {
		if ( err instanceof TimeoutError )
		    return this.showStatusView( 408, {
			"title": "Connection Timeout",
			"message": `Request Timeout - Client could not connect to the Conductor interface`,
			"details": [
			    `${err.name}: ${err.message}`,
			],
		    });
		else
		    console.error( err );
	    }

	},
	"methods": {
	    dismissError ( index ) {
		this.errors.splice( index, 1 );
	    },
	},
    });

    app.mixin({
	data () {
	    return {
		"json":			json,
		"Entity":		EntityArchitect.Entity,
		"Collection":		EntityArchitect.Collection,

		console,
	    };
	},
	"computed": {
	},
	"methods": {
	    $debug ( value ) {
		log.trace("JSON debug for value:", value );
		return json.debug( value );
	    },
	    navigateBack () {
		if ( history.length > 2 )
		    history.back();
		else
		    this.$router.push("/");
	    },
	    async mustGet ( callback ) {
		try {
		    await callback();
		} catch (err) {
		    this.catchStatusCodes([ 404, 500 ], err );
		    log.error("Failed to get required resource(s): %s", err.message, err );
		}
	    },
	    async catchStatusCodes ( status_codes, err ) {
		if ( !Array.isArray(status_codes) )
		    status_codes	= [ status_codes ];

		status_codes.forEach( (code, i) => {
		    status_codes[i]	= parseInt( code );
		});

		if ( status_codes.includes( 404 ) && err.name === "EntryNotFoundError" )
		    this.$root.showStatusView( 404 );
		else if ( status_codes.includes( 500 ) )
		    this.$root.showStatusView( 500 );
	    },
	    async showStatusView ( status, data = null ) {
		if ( !status ) { // reset status view
		    this.$root.status_view_html = null;
		    return;
		}

		if ( data ) {
		    this.$root.status_view_data = Object.assign( {
			"code": status,
			"title": "It's not me, it's you",
			"message": "Default HTTP Code Name",
			"details": null,
		    }, data );
		    this.$root.status_view_html = true;

		    return;
		}

		try {
		    this.$root.status_view_html = await common.load_html(`/templates/${status}.html`);
		} catch (err) {
		    log.error("%s", err.message, err );
		    this.$root.status_view_html = await common.load_html(`/templates/500.html`);
		}
	    },
	    getPathId ( key ) {
		const path_id		= this.$route.params[key];

		try {
		    return new holohash.ActionHash( path_id );
		} catch (err) {
		    if ( err instanceof holohash.HoloHashError ) {
			this.showStatusView( 400, {
			    "title": "Invalid Identifier",
			    "message": `Invalid Holo Hash in URL path`,
			    "details": [
				`<code>${path_id}</code>`,
				`${err.name}: ${err.message}`,
			    ],
			});
		    }

		    throw err;
		}
	    },
	    async createMereMemoryEntry ( bytes ) {
		const path			= `appstore/memory/${common.randomHex()}`;
		this.$openstate.mutable[path]	= bytes;
		const addr			= await this.$openstate.write( path );
		this.$openstate.purge( path );
		return addr;
	    },

	    ...common,
	},
    });

    Object.assign( app.config.globalProperties, {
	window,
	document,
	history,
	location,
	"$clients":		[appstore],
	"$filters":		filters,
	"$openstate":		openstate,
	breadcrumb_mapping,
    });

    app.config.compilerOptions.isCustomElement = (tag) => {
	if ( tag.startsWith("router") )
	    return false;

	return tag.includes('-');
    };

    app.config.errorHandler		= function (err, vm, info) {
	log.error("Vue App Error (%s):", info, err, vm );
	$root.errors.push( err.message );
    };

    window.addEventListener("unhandledrejection", (event) => {
	$root.errors.push( event.reason );
    });
    window.addEventListener("error", (err) => {
	$root.errors.push( err.message );
    });


    app.use( router );
    app.mount("#app");

    global._App				= app;
    global._Router			= router;

    log.info("Finished App configuration and mounting");
})(window);
