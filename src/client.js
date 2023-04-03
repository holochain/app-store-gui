const { Logger }			= require('@whi/weblogger');
const log				= new Logger("client");

const { DnaHash,
	AgentPubKey }			= holohash;
const { AgentClient }			= HolochainClient;
const { CruxConfig,
	Translator }			= CruxPayloadParser;


module.exports = async function ( CONDUCTOR_URI, APP_ID ) {
    const { AgentClient }		= await HolochainClient;
    const crux_config			= new CruxConfig();
    const interpreter			= new Translator([]);

    const appstore			= await AgentClient.createFromAppInfo( APP_ID, CONDUCTOR_URI );

    log.normal("App Store client (Cell %s): %s", appstore.cellAgent(), appstore.capabilityAgent() );

    // console.log( appstore );

    appstore.addProcessor("input", async function (input) {
	let keys			= input ? `{ ${Object.keys( input ).join(", ")} }` : "";
	log.trace("Calling %s::%s->%s(%s)", this.dna, this.zome, this.func, keys );
	return input;
    });
    appstore.addProcessor("output", async function (output) {
	log.trace("Response for %s::%s->%s(%s)", this.dna, this.zome, this.func, this.input ? " ... " : "", output );
	return output;
    });

    appstore.addProcessor("output", (essence, req) => {
	if ( !( req.dna === "portal"
		&& req.zome === "portal_api"
		&& req.func === "custom_remote_call"
	      ) )
	    return essence;

	let pack;
	try {
	    log.debug("Portal wrapper (%s)", essence.type, essence.payload );
	    pack			= interpreter.parse( essence );
	} catch ( err ) {
	    log.error("Error unwrapping portal response response:", err );
	    return essence;
	}

	const payload		= pack.value();

	if ( payload instanceof Error )
	    throw payload;

	return payload;
    });

    log.normal("App schema");
    log.level.normal && Object.entries( appstore._app_schema._dnas ).forEach( ([nick, schema]) => {
	log.normal("  %s : %s", nick.padStart( 10 ), String( schema._hash ) );

	log.level.info && Object.entries( schema._zomes ).forEach( ([name, zome_api]) => {
	    log.info("  %s : %s", name.padStart( 10 ), zome_api._name );
	});
    });

    crux_config.upgrade( appstore );

    return [ appstore ];
}
