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
		    value.published_at	= value.published_at.toISOString();
		    value.last_updated	= value.last_updated.toISOString();
		}
		return value;
	    },
	},
    });

    openstate.addHandlers({
	...appstore_config( appstore ),
    });

    return openstate;
};
