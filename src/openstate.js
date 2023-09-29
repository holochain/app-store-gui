const { Logger }			= require('@whi/weblogger');
const log				= new Logger("openstate");

const OpenState				= require('openstate');
const appstore_config			= require('./openstate_configs/appstore.js');

const { reactive }			= Vue;
const { EntityArchitect }		= CruxPayloadParser;
const { Entity }			= EntityArchitect;
const { HoloHash,
	AgentPubKey }			= holohash;

module.exports = async function ([ appstore ]) {
    const openstate			= new OpenState.create({
	reactive,
	"globalDefaults": {
	    adapter ( value ) {
		if ( value instanceof Entity ) {
		    if ( value.author )
			value.author		= new AgentPubKey( value.author );
		    if ( value.published_at )
			value.published_at	= new Date( value.published_at );
		    if ( value.last_updated )
			value.last_updated	= new Date( value.last_updated );
		}
	    },
	    toMutable ( value ) {
		if ( value instanceof Entity ) {
		    value		= value.toJSON().content;

		    if ( value.published_at instanceof Date )
			value.published_at	= (new Date( value.published_at )).toISOString();
		    if ( value.last_updated instanceof Date )
			value.last_updated	= (new Date( value.last_updated )).toISOString();
		}
		return value;
	    },
	},
    });

    const devhub			= {
	async call ( dna_hash, zome, func, payload, timeout ) {
	    const available_host	= await openstate.get(`devhub/hosts/${dna_hash}/${zome}/${func}/any`);
	    const call_details		= {
		"dna": dna_hash,
		"zome": zome,
		"function": func,
		"payload": payload,
	    };
	    return await appstore.call("portal", "portal_api", "custom_remote_call", {
		"host": available_host.author,
		"call": call_details,
	    }, timeout );
	}
    };

    openstate.addHandlers({
	...appstore_config( appstore, devhub ),
    });

    return openstate;
};
