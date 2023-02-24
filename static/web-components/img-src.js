class HTMLImgSrcElement extends HTMLElementTemplate {
    static CSS				= `
:host {
}

img {
  object-fit: cover;
  width: 100%;
  height: 100%;
}
`;
    static template			= `
<img>
`;
    static refs				= {
	"$img":			`img`,
    };


    // Element constants

    static properties			= {
	"bytes":{
	    "reflect": false,
	    updateDOM () {
		this.$img.src		= URL.createObjectURL(
		    new Blob([this.bytes], { type: 'image/png' })
		);
	    },
	},
    };

    attributeCallback ( name, _, value ) {
	if ( !["width", "height", "alt", "title"].includes( name ) )
	    return;

	if ( value === null )
	    this.$img.removeAttribute( name );
	else
	    this.$img.setAttribute( name, value );
    }
}

customElements.define("img-src", HTMLImgSrcElement );
