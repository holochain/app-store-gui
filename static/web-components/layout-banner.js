
class HTMLLayoutBannerElement extends HTMLElementTemplate {
    static CSS				= `
:host {
  max-width: 100vw;
}

.exhibit {
  width: 100%;
  height: 300px;
}
.exhibit::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(10deg, rgba(65,235,217,.7) 0%, rgba(142,59,249,0.7) 100%);
}

#banner {
  width: 100%;
  display: flex !important;
  align-items: center !important;
  flex-direction: column-reverse !important;
}

#banner-container {
  position: relative;
  padding-top: var(--bs-2-size);
  padding-bottom: var(--bs-2-size);
}
#banner-spotlight {
  position: absolute;
  width: 300px;
  height: 300px;
  background-color: #808080;

  border-radius: 50% !important;
  --bs-border-width: 2px;
  --bs-border-opacity: 1;
  border-color: rgba(var(--bs-white-rgb), var(--bs-border-opacity)) !important;
  border: var(--bs-border-width) var(--bs-border-style) var(--bs-border-color) !important;
  overflow: hidden !important;
}
slot[name=spotlight]::slotted(*) {
  height: 300px;
}
#banner-actions {
  position: absolute;
}

.container {
  max-width: 1000px;
  box-sizing: border-box;

  --bs-gutter-x: 1.5rem;
  --bs-gutter-y: 0;
  width: 100%;
  padding-right: calc(var(--bs-gutter-x) * 0.5);
  padding-left: calc(var(--bs-gutter-x) * 0.5);
  margin-right: auto;
  margin-left: auto;
}

@media (max-width: 1000px) {
  #banner {
    height: 200px;
  }
  #banner-spotlight {
    bottom: -50px;
    right: var(--bs-2-size);
  }
  #banner-actions {
    top: 0;
    left: 0;
    padding-top: var(--bs-2-size);
    padding-left: var(--bs-2-size);
  }
}

@media (min-width: 1000px) and (max-width: 1760px) {
  #banner {
    height: 300px;
  }
  #banner-spotlight {
    bottom: -100px;
    right: var(--bs-2-size);
  }
  #banner-actions {
    top: 0;
    right: 0;
    padding-top: var(--bs-2-size);
    padding-right: var(--bs-2-size);
  }
}

@media (min-width: 1760px) {
  #banner {
    height: 400px;
  }
  #banner-spotlight {
    bottom: -100px;
    left: -330px;
  }
  #banner-actions {
    bottom: 0;
    right: 0;
    padding-bottom: var(--bs-3-size);
    padding-right: var(--bs-5-size);
  }
}
`;
    static template			= `
<identicon-container id="banner" class="exhibit">
    <div id="banner-container" class="container">
        <div id="banner-spotlight">
            <slot name="spotlight"></slot>
        </div>

        <slot></slot>
    </div>
    <div id="banner-actions">
        <slot name="actions"></slot>
    </div>
</identicon-container>
`;
    static refs				= {
	"$container":			`identicon-container`,
    };


    // Element constants

    static properties			= {
	"seed":{
	    updateDOM () {
		this.$container.seed		= this.seed;
	    },
	},
    };
}

customElements.define("layout-banner", HTMLLayoutBannerElement );
