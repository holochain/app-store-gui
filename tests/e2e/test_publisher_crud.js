const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const { Holochain }			= require('@whi/holochain-backdrop');

require('../set_global_context.js');

const crypto				= require('crypto');
const expect				= require('chai').expect;

const common				= require('../../src/common.js');
const openstate_init			= require('../../src/openstate.js');

const APPSTORE_PATH			= path.join( __dirname, "../appstore.happ" );
const DEVHUB_PATH			= path.join( __dirname, "../devhub.happ" );

let openstate;

async function publisher_state ( datapath, read, writable ) {
    return common.scopedState( openstate, datapath, read, writable, mutable => {
	mutable.name			= "Testing";
	mutable.location.country	= "Gibraltar";
	mutable.location.region		= "Gibraltar";
	mutable.location.city		= "Gibraltar";
	mutable.website.url		= "https://github.com/holo-host";
	mutable.website.context		= "github";
	mutable.icon			= new Uint8Array([1,2,3]);
    });
}

function mvp_tests () {

    it("should get agent", async function () {
	this.timeout( 30_000 );

	const info			= await openstate.read(`agent/me`);

	expect( info.pubkey.initial	).to.be.a("AgentPubKey");
    });

    it("should create publisher", async function () {
	const datapath			= `publisher/${common.randomHex()}`;
	const [$data, data$]		= await publisher_state( datapath );

	expect( $data.writable	).to.be.true;

	const data			= await openstate.write( datapath );

	expect( data.$id		).to.be.an("ActionHash");
	expect( data.name		).to.equal("Testing");
	expect( data.editors		).to.have.length( 1 );

	expect( $data.writable		).to.be.true;
    });

    it("should get all publishers", async function () {
	const datapath			= `publishers`;
	const $data			= openstate.metastate[ datapath ];
	const data			= await openstate.read( datapath );

	expect( $data.writable		).to.be.false;

	expect( data			).to.have.length( 1 );
    });

    it("should update publisher", async function () {
	const publishers		= await openstate.read(`publishers`);
	const datapath			= `publisher/${publishers[0].$id}`;

	await openstate.read( datapath );

	const $data			= openstate.metastate[ datapath ];
	const data$			= openstate.mutable[ datapath ];

	expect( $data.writable	).to.be.true;

	data$.website			= {
	    "url": "https://github.com/holochain",
	    "context": "github",
	};

	expect( $data.changed	).to.be.true;

	const data			= await openstate.write( datapath );
    });

}

function optional_input_tests () {

    it("should create publisher with optional input", async function () {
	const datapath			= `publisher/${common.randomHex()}`;
	const [$data, data$]		= await publisher_state( datapath );

	expect( $data.writable	).to.be.true;

	data$.editors			= [
	    new holohash.AgentPubKey( crypto.randomBytes(32) ),
	];

	const data			= await openstate.write( datapath );

	expect( data.$id		).to.be.an("ActionHash");
	expect( data.name		).to.equal("Testing");
	expect( data.editors		).to.have.length( 2 );

	expect( $data.writable		).to.be.true;
    });

}

function invalid_tests () {

    it("should have rejections", async function () {
	const datapath			= `publisher/${common.randomHex()}`;
	const [ $data, data$, _,
		rejections ]		= await publisher_state( datapath );

	data$.name			= null;

	expect( $data.valid		).to.be.false;
	expect( rejections		).to.have.length( 1 );
	expect( rejections[0]		).to.have.string("required");
    });

}


describe("Openstate: Publisher", () => {
    const crux				= new CruxPayloadParser.CruxConfig();
    const holochain			= new Holochain({
	"default_stdout_loggers": process.env.LOG_LEVEL === "silly",
	"timeout": 30_000,
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

    describe("MVP", mvp_tests.bind( this ) );
    describe("Optional Input", optional_input_tests.bind( this ) );
    describe("Invalid", invalid_tests.bind( this ) );

});
