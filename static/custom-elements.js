function fallbackCopyTextToClipboard ( text ) {
    let textArea			= document.createElement("textarea");
    textArea.value			= text;

    textArea.style.bottom		= "0";
    textArea.style.right		= "0";
    textArea.style.position		= "fixed";

    document.body.appendChild( textArea );
    textArea.focus();
    textArea.select();

    try {
	if ( !document.execCommand('copy') )
	    throw new Error(`Unable to copy to clipboard`);
    } finally {
	document.body.removeChild( textArea );
    }
}

class IdenticonImg extends LitElement {
    static DEFAULT_COLOR		= false;
    static DEFAULT_SIZE			= 25;

    static get properties () {
	return {
	    "seed": {
		"type": String,
		"reflect": true,
	    },
	    "size": {
		"reflect": true,
	    },
	    "color": {
		"type": Boolean,
		"reflect": true,
	    },
	};
    }

    static styles = [
	css`.identicon {
  border-radius: 50%;
}`,
    ];

    constructor () {
	super();

	this.color			= this.constructor.DEFAULT_COLOR;
	this.size			= this.constructor.DEFAULT_SIZE;
    }

    async copyToClipboard () {
	if ( !navigator.clipboard )
	    return fallbackCopyTextToClipboard( String(this.seed) );

	await navigator.clipboard.writeText( String(this.seed) );
    }

    render () {
	this.style.width		= this.size + "px";
	this.style.height		= this.size + "px";

	const size			= parseInt( this.size );
	const identicon			= Identicons.renderDiscs({
	    "seed": String(this.seed),
	    "width": size,
	    "height": size,
	    "colorRange": 15,
	    "grayscale": this.color !== true,
	});

	const dynamic_css		= unsafeCSS(`
:host {
  max-width: ${this.size}px;
  max-height: ${this.size}px;
}
`);

	return html`
<style>${dynamic_css}</style>

<img class="identicon" title="Click to copy hash" src=${identicon.dataURL} @click=${this.copyToClipboard}>
`;
    }
}

customElements.define("identicon-img", IdenticonImg );



class IdenticonContainer extends LitElement {
    static get properties () {
	return {
	    "seed": {
		"type": String,
		"reflect": true,
	    },
	    "color": {
		"type": Boolean,
		"reflect": true,
	    },
	    "color-base": {
		"type": Number,
		"reflect": true,
	    },
	};
    }

    static styles = [
	css`
:host {
  display: block;
  position: relative;
}
`,
    ];

    constructor () {
	super();

	this.color			= false;

	window.addEventListener( "resize", event => {
	    this.requestUpdate();
	});
    }

    render () {
	if ( !(this.offsetWidth && this.offsetHeight) )
	    return html`Invisible`;

	if ( !this.seed )
	    return html`<slot></slot>`;

	const identicon			= Identicons.renderDiscs({
	    "seed": this.seed,
	    "width": this.offsetWidth,
	    "height": this.offsetHeight,
	    "colorRange": 15,
	    "base": this["color-base"],
	    "grayscale": !this.color,
	});

	// rgb(65,235,217)
	// rgb(142,59,249)
	const dynamic_css		= css`
:host {
  background-image: url(${unsafeCSS(identicon.dataURL)});
}
`;
	// width: ${this.width};
	// height: ${this.height};

	return html`
<style>${dynamic_css}</style>

<slot></slot>
`;
    }
}

customElements.define("identicon-container", IdenticonContainer );
