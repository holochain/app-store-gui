
if ( !customElements.get("img-src") )
    throw new Error(`<holochain-img> depends on Web Component <img-src>`);


class HTMLHolochainImgElement extends HTMLElementTemplate {
    static CSS				= `
:host {
  display: inline-block;
  position: relative;
  width: 100%;
  height: 100%;
}

.spinner-border {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;

  display: inline-block;
  width: 2em;
  height: 2em;

  border: 0.25em solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  vertical-align: -0.125em;
  animation: 0.75s linear infinite spinner-border;
}

@keyframes spinner-border {
  from {
    transform: rotate( 0deg );
  }
  to {
    transform: rotate( 359deg );
  }
}
`;

    static template			= `
<div class="spinner-border"></div>
<img-src style="display: none;"></img-src>
`;
    static refs				= {
	"$img":			`img-src`,
	"$loading":		`.spinner-border`,
    };


    // Element constants

    static properties			= {
	"os-path": {
	    async updateDOM () {
		const path		= this['os-path'];
		const bytes		= await openstate.read( path );

		this.$img.bytes		= bytes;

		this.$loading.style.display	= "none";
		this.$img.style.display		= "initial";
	    },
	},
    };

    constructor () {
	super();
    }


    // Property/attribute controllers


    // Methods


    // Event handlers
}

customElements.define("holochain-img", HTMLHolochainImgElement );
