const { Logger }			= require('@whi/weblogger');
const log				= new Logger("viewpoint");

global.WebSocket 			= require('ws');

const json				= require('@whi/json');
const { AgentPubKey,
	ActionHash }			= require('@whi/holo-hash');
const { AgentClient }			= require('@whi/holochain-client');

const APP_ID				= "app-store";
const APP_PORT				= 44_001;

if ( process.argv.length < 3 )
    throw new Error(`Missing arguments for admin and member hashes`);

const args				= process.argv.slice(2);
const admins				= args.map( hash => new AgentPubKey(hash) );

(async function () {
    const appstore			= await AgentClient.createFromAppInfo( APP_ID, APP_PORT );

    console.log("Creating a group with admins: %s", json.debug(admins) );
    const group_input			= {
	"admins": admins,
	"members": [],

	"published_at":		Date.now(),
	"last_updated":		Date.now(),
	"metadata":		{},
    };
    const response			= await appstore.call("appstore", "appstore_api", "create_group", group_input );
    const group				= response.payload;

    console.log("Group ID: %s", new ActionHash(group.id) );

    appstore.close();
})();
