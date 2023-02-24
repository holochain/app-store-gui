const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

global.WebSocket			= require('ws');

const fs				= require('fs');
const { AdminClient,
	ConductorError,
	...hc_client }			= require('@whi/holochain-client');

if ( process.env.LOG_LEVEL )
    hc_client.logging();

const APPSTORE_HAPP			= path.resolve( __dirname, "appstore.happ" );
const DEVHUB_HAPP			= path.resolve( __dirname, "devhub.happ" );
const HAPPS				= {
    "app-store":	APPSTORE_HAPP,
    "devhub":		DEVHUB_HAPP,
};

const PORT				= 35678;
const admin				= new AdminClient( PORT );

function print ( msg, ...args ) {
    console.log(`\x1b[37m${msg}\x1b[0m`, ...args );
}

(async function () {
    try {
	const APP_PREFIX		= process.argv[2];
	const AGENT_NICKNAME		= process.argv[3] || null;
	const AGENT_FILENAME		= AGENT_NICKNAME === null
	      ? "AGENT" : `AGENT_${AGENT_NICKNAME}`;

	try {
	    await admin.attachAppInterface( 44001 );
	} catch (err) {
	    if ( !( err instanceof ConductorError
		    && err.message.includes("Address already in use") ) )
		throw err;
	}

	const agent_file		= path.resolve( __dirname, AGENT_FILENAME );
	let agent_hash;

	if ( fs.existsSync( agent_file ) ) {
	    print("Not creating Agent because `%s` already exists", agent_file )
	    agent_hash			= new hc_client.HoloHash( fs.readFileSync( agent_file, "utf8" ) );
	} else {
	    agent_hash			= await admin.generateAgent();
	    print("Agent hash: %s (%s)", agent_hash.toString(), AGENT_NICKNAME );
	    fs.writeFileSync( agent_file, agent_hash.toString() );
	}
	console.log( agent_hash );


	const INSTALLED_APPS		= await admin.listApps();
	console.log( JSON.stringify( INSTALLED_APPS.map(info => info.installed_app_id), null, 4 ) );
	const HAPP_FILE			= HAPPS[ APP_PREFIX ];

	const APP_ID			= AGENT_NICKNAME === null
	      ? APP_PREFIX : `${APP_PREFIX}-${AGENT_NICKNAME}`;
	let installation		= INSTALLED_APPS.find( app => app.installed_app_id === APP_ID );

	try {
	    if ( !installation ) {
		installation		= await admin.installApp(
		    APP_ID, agent_hash, HAPP_FILE
		);
	    }
	} catch (err) {
	    if ( err instanceof ConductorError
		 && err.message.includes("AppAlreadyInstalled") )
		print("App '%s' is already installed", APP_ID );
	    else
		throw err;
	}

	try {
	    await admin.enableApp( APP_ID );
	} catch (err) {
	    if ( err instanceof ConductorError
		 && err.message.includes("AppNotInstalled") ) // already active
		print("App '%s' is already activated", APP_ID );
	    else
		throw err;
	}

	const apps			= (await admin.listApps( "enabled" ))
	      .reduce( (acc, info) => {
		  acc[info.installed_app_id] = info;
		  return acc;
	      }, {});
	const app_info			= apps[ APP_ID ];

	print("Creating unrestricted cap grant for testing");
	for ( let role_name in app_info.roles ) {
	    const dna_hash		= app_info.roles[ role_name ].cell_id[0];
	    await admin.grantUnrestrictedCapability( "testing", agent_hash, dna_hash, "*" );
	}
    } catch (err) {
	console.log("Setup exiting in failure:");
	console.error( err );
    } finally {
	await admin.close();
    }
})();
