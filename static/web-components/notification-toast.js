class HTMLNotificationToastElement extends HTMLElementTemplate {
    static CSS				= `
:host {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    background-color: rgba(255, 255, 255, 0.9);
    background-clip: padding-box;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
.toast {
    flex-grow: 1;
}

.toast > i {
    margin-right: 8px;
}

.dismiss {
    box-sizing: content-box;
    width: 1em;
    height: 1em;
    margin: auto;
    margin-right: 0;
    padding: 0.25em 0.25em;
    color: #000;
    background: transparent url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e") center/1em auto no-repeat;
    border: 0;
    border-radius: 0.375rem;
    opacity: 0.5;
    cursor: pointer;
}
`;

    static template			= `
<div class="toast">
    <slot></slot>
</div>
<a class="dismiss"></a>
`;
    static refs				= {
	"$toast":		`.toast`,
	"$body":		`.toast-body`,
	"$dismiss":		`.dismiss`,
    };


    // Element constants

    static properties			= {};


    constructor () {
	super();

	this.$dismiss.addEventListener("click", event => {
	    this.dispatchEvent( new Event('dismiss') );
	});
    }
}

customElements.define("notification-toast", HTMLNotificationToastElement );


class HTMLNotificationBoxElement extends HTMLElementTemplate {
    static CSS				= `
:host {
    position: fixed;
    z-index: 1090;

    box-sizing: border-box;
    width: 50vw;
    max-width: 100%;
}
`;

    static template			= `
<slot></slot>
`;
    static refs				= {};


    // Element constants

    static observedAttributes		= [
	"top",
	"bottom",
	"left",
	"right",
    ];

    static properties			= {
	"top": {
	    updateDOM () {
		this.style.top = this.top || 0;
	    },
	},
	"bottom": {
	    updateDOM () {
		this.style.bottom = this.bottom || 0;
	    },
	},
	"left": {
	    updateDOM () {
		this.style.left = this.left || 0;
	    },
	},
	"right": {
	    updateDOM () {
		this.style.right = this.right || 0;
	    },
	},
    };
}

customElements.define("notification-box", HTMLNotificationBoxElement );
