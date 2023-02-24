const { Logger }			= require('@whi/weblogger');
const log				= new Logger("client");

const { DnaHash,
	AgentPubKey }			= holohash;
const { AgentClient }			= HolochainClient;
const { CruxConfig }			= CruxPayloadParser;

const APP_ID				= localStorage.getItem("APP_ID") || "app-store";

module.exports = async function ( CONDUCTOR_URI ) {
    const { AgentClient }		= await HolochainClient;
    const crux_config			= new CruxConfig();

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

    crux_config.upgrade( appstore );

    return [ appstore ];
}
