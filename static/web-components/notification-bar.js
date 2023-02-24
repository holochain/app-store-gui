class HTMLNotificationBarElement extends HTMLElementTemplate {
    static CSS				= `
:host {
  position: fixed;
  z-index: 99;
  top: 0;
  font-size: 1rem;

  display: flex;
  flex-direction: column;

  width: 100%;
  text-align: center;
  background-color: #fff;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
#details {
  max-width: 100%;
  overflow-x: auto;
  font-size: .9em;
}
#dismiss {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translate(-50%, -50%) !important;

  box-sizing: content-box;
  width: 1em;
  height: 1em;
  padding: 0.25em 0.25em;
  color: #000;
  background: transparent url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e") center/1em auto no-repeat;
  border: 0;
  border-radius: 0.375rem;
  opacity: 0.5;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.row {
  flex-wrap: wrap;
}

.expand {
  position: absolute;
  left: 0;
  width: 100%;
}
.top {
  top: 0;
}
.bottom {
  bottom: 0;
}

.chevron-expand,
.chevron-collapse {
  display: inline-block;
  width: 16px;
  height: 16px;
}
.top .chevron-expand,
.bottom .chevron-collapse {
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 16 16'><path fill-rule='evenodd' d='M7.776 5.553a.5.5 0 0 1 .448 0l6 3a.5.5 0 1 1-.448.894L8 6.56 2.224 9.447a.5.5 0 1 1-.448-.894l6-3z'/></svg>") no-repeat center;
}
.bottom .chevron-expand,
.top .chevron-collapse {
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 16 16'><path fill-rule='evenodd' d='M1.553 6.776a.5.5 0 0 1 .67-.223L8 9.44l5.776-2.888a.5.5 0 1 1 .448.894l-6 3a.5.5 0 0 1-.448 0l-6-3a.5.5 0 0 1-.223-.67z'/></svg>") no-repeat center;
}
a {
  cursor: pointer;
}
.hide,
.collapse:not(.show) {
  display: none;
}
.collapsing {
  overflow: hidden;
  transition: height 0.35s ease;
}
@media (prefers-reduced-motion: reduce) {
  .collapsing {
    transition: none;
  }
}
`;

    static template			= `
<a id="dismiss"></a>

<div class="row flex-center">
    <span>
        <slot></slot>
    </span>
</div>
<div class="row flex-center">
    <div id="details" class="collapse hide">
        <slot name="details"></slot>
    </div>
</div>
<div class="expand flex-center hide bottom" style="opacity: .7">
    <a id="show-details" class="chevron-expand"></a>
    <a id="hide-details" class="chevron-collapse hide"></a>
</div>
`;
    static refs				= {
	"$dismiss":		`#dismiss`,
	"$details":		`#details`,
	"$open_btn":		`#show-details`,
	"$close_btn":		`#hide-details`,
	"$expand":		`.expand`,
    };


    // Element constants

    static properties			= {
	"no-dismiss": {
	    "type": Boolean,
	    updateDOM () {
		const no_dismiss	= this['no-dismiss'];

		this.$dismiss.style.display	= no_dismiss ? "none" : "initial";
	    },
	},
	"bottom": {
	    "type": Boolean,
	    updateDOM () {
		console.log("bottom:", this.bottom );
		if ( this.bottom ) {
		    this.style.top		= "initial";
		    this.style.bottom		= 0;
		    this.$expand.classList.remove("bottom");
		    this.$expand.classList.add("top");
		} else {
		    this.style.top		= 0;
		    this.style.bottom		= "initial";
		    this.$expand.classList.remove("top");
		    this.$expand.classList.add("bottom");
		}
	    },
	},
    };

    constructor () {
	super();

	this.$open_btn.addEventListener("click", event => {
	    this.$details.style.height	= 0;

	    this.$details.classList.add("collapsing");
	    this.$details.classList.remove("collapse");

	    this.$open_btn.classList.add("hide");
	    this.$close_btn.classList.remove("hide");

	    setTimeout(() => {
		this.$details.classList.remove("collapsing");
		this.$details.classList.add("collapse", "show");

		this.$details.style.height	= "";
	    }, 350 );

	    this.$details.style.height		= `${this.$details.scrollHeight}px`;
	});
	this.$close_btn.addEventListener("click", event => {
	    this.$details.style.height		= `${this.$details.getBoundingClientRect().height}px`;

	    // trigger reflow (https://stackoverflow.com/questions/21664940/force-browser-to-trigger-reflow-while-changing-css)
	    this.$details.offsetHeight;

	    this.$open_btn.classList.remove("hide");
	    this.$close_btn.classList.add("hide");

	    this.$details.classList.add("collapsing");
	    this.$details.classList.remove("collapse", "show");

	    setTimeout(() => {
		this.$details.classList.remove("collapsing");
		this.$details.classList.add("collapse");
		this.$details.style.height	= "";
	    }, 350 );

	    this.$details.style.height		= 0;
	});

	this.$dismiss.addEventListener("click", event => {
	    this.dispatchEvent( new Event('dismiss') );
	});
    }

    // connectedCallback() {
    // }

    mutationCallback() {
	if ( this.slots.details ) {
	    this.$details.classList.remove("hide");
	    this.$expand.classList.remove("hide");
	} else {
	    this.$details.classList.add("hide");
	    this.$expand.classList.add("hide");
	}
    }


    // Property/attribute controllers


    // Methods


    // Event handlers
}

customElements.define("notification-bar", HTMLNotificationBarElement );
