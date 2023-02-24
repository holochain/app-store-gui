
class AnchorIcon extends LitElement {
    static get properties () {
	return {
	    "href": {
		"type": String,
		"reflect": true,
	    },
	};
    }

    static styles = [
	css`
:host {
}

a {

    position: relative !important;

    width: 2em !important;
    height: 2em !important;
    padding: 0;
    border-radius: 50%;
    border: 0;

    font-size: 1.5em !important;

    display: inline-block;
    color: var(--bs-btn-color);
    text-align: center;
    text-decoration: none;
    vertical-align: middle;
    cursor: pointer;
    user-select: none;
    background-color: var(--bs-btn-bg);
    transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

a > ::slotted(i) {
    color: white !important;

    position: absolute !important;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

a:hover {
    color: var(--bs-btn-hover-color);
    background-color: var(--bs-btn-hover-bg);
    border-color: var(--bs-btn-hover-border-color);
}

a:active {
    color: var(--bs-btn-active-color);
    background-color: var(--bs-btn-active-bg);
    border-color: var(--bs-btn-active-border-color);
}

:host.disabled a {
    color: var(--bs-btn-disabled-color);
    pointer-events: none;
    background-color: var(--bs-btn-disabled-bg);
    border-color: var(--bs-btn-disabled-border-color);
    opacity: var(--bs-btn-disabled-opacity);
}
`,
    ];

    constructor () {
	super();
    }

    anchorWithRef () {
	return html`
<a href="${this.href}">
   <slot></slot>
</a>
`;
    }

    anchorWithoutRef () {
	return html`
<a>
   <slot></slot>
</a>
`;
    }

    render () {
	return this.href
	    ? this.anchorWithRef()
	    : this.anchorWithoutRef();
    }
}

customElements.define("a-icon", AnchorIcon );
