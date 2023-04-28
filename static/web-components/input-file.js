class HTMLInputFileElement extends HTMLElementTemplate {
    static CSS				= `
:host {
}
`;

    static template			= `
<input type="file" style="display:none;">
<slot></slot>
`;
    static refs				= {
	"$input":		`input`,
    };


    // Element constants

    static properties			= {
	"accept": {
	    async updateDOM () {
		this.$input.setAttribute("accept", this.accept );
	    },
	},
    };

    constructor () {
	super();

	this.addEventListener("click", event => {
	    this.$input.click();
	});

	this.$input.addEventListener("input", this.loadFile.bind(this) );
    }

    // connectedCallback() {
    // }


    // Property/attribute controllers


    // Methods
    updateValue ( value ) {
	this.value		= value;
	const input		= new InputEvent('input');
	this.dispatchEvent( input );

	const change		= new InputEvent('change');
	this.dispatchEvent( change );
    }

    // Event handlers

    loadFile ( event ) {
	if ( event.target.files.length === 0 )
	    return this.updateValue( null );

	const $this			= this;
	const file			= event.target.files[0];
	const reader			= new FileReader();

	reader.readAsArrayBuffer( file );
	reader.onerror		= function (err) {
	    console.error("FileReader error event:", err );
	};
	reader.onload		= function (evt) {
	    let result		= new Uint8Array( evt.target.result );
	    $this.updateValue( result );
	};
	reader.onprogress		= function (p) {
	    // console.log("progress:", p );
	};
    }

    attributeCallback ( name, _, value ) {
	if ( !["accept"].includes( name ) )
	    return;

	if ( value === null )
	    this.$input.removeAttribute( name );
	else
	    this.$input.setAttribute( name, value );
    }
}

customElements.define("input-file", HTMLInputFileElement );
