const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const { Holochain }			= require('@whi/holochain-backdrop');

global.Vue				= require('vue');
global.showdown				= require('showdown');
global.holohash				= require('@whi/holo-hash');
global.HolochainClient			= require('@whi/holochain-client');
global.CruxPayloadParser		= require('@whi/crux-payload-parser');

const crypto				= require('crypto');
const expect				= require('chai').expect;

const common				= require('../../src/common.js');
const openstate_init			= require('../../src/openstate.js');


const APPSTORE_PATH			= path.join( __dirname, "../appstore.happ" );
const DEVHUB_PATH			= path.join( __dirname, "../devhub.happ" );

let openstate;

function basic_tests () {

    it("should get agent", async function () {
	this.timeout( 30_000 );

	const info		= await openstate.read(`agent/me`);

	expect( info.pubkey.initial	).to.be.a("AgentPubKey");
    });

    it("should create publisher", async function () {
	this.timeout( 10_000 );

	const datapath			= `publisher/${common.randomHex()}`;
	const $publisher		= await openstate.metastate[ datapath ];
	const publisher$		= await openstate.mutable[ datapath ];

	expect( $publisher.writable	).to.be.true;

	publisher$.name			= "Testing";
	publisher$.location		= {
	    "country": "Gibraltar",
	    "region": "Gibraltar",
	    "city": "Gibraltar",
	};
	publisher$.website		= {
	    "url": "https://github.com/holo-host",
	    "context": "github",
	};
	publisher$.icon			= new Uint8Array([1,2,3]);
	publisher$.editors		= [
	    new holohash.AgentPubKey( crypto.randomBytes(32) ),
	];

	const publisher			= await openstate.write( datapath );

	expect( publisher.$id		).to.be.an("ActionHash");
	expect( publisher.name		).to.equal("Testing");
	expect( publisher.editors	).to.have.length( 2 );

	expect( $publisher.writable	).to.be.true;
    });

}

describe("Openstate", () => {
    const crux				= new CruxPayloadParser.CruxConfig();
    const holochain			= new Holochain({
	"default_stdout_loggers": process.env.LOG_LEVEL === "silly",
    });

    let actors;

    before(async function () {
	this.timeout( 30_000 );

	log.debug("Waiting for holochain to start...");
	await holochain.start( 5_000 );

	actors			= await holochain.backdrop({
	    "appstore":	APPSTORE_PATH,
	    "devhub":	DEVHUB_PATH,
	});

	for ( let name in actors ) {
	    for ( let app_prefix in actors[ name ] ) {
		log.info("Upgrade client for %s => %s", name, app_prefix );
		crux.upgrade( actors[ name ][ app_prefix ].client );
	    }
	}

	openstate		= await openstate_init([ actors.alice.appstore.client, actors.alice.devhub.client ]);
    });

    after(async () => {
	await holochain.destroy();
    });

    describe("Basic", basic_tests.bind( this ) );

});
