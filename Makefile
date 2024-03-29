
SHELL			= bash
PROJECT_NAME		= appstore

APPSTORE_WEBHAPP	= appstore.webhapp
APPSTORE_HAPP		= tests/appstore.happ
DEVHUB_HAPP		= tests/devhub.happ
HAPPS			= $(APPSTORE_HAPP) $(DEVHUB_HAPP)


#
# Runtime Setup
#
run-holochain:		node_modules
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -v
reset-holochain:
	rm -rf holochain/databases holochain/config.yaml tests/*_HASH
reset-lair:
	rm -rf holochain/lair tests/AGENT*
reset-all:		reset-holochain reset-lair
setup:			$(HAPPS)
	node tests/setup.js app-store
	node tests/setup.js devhub	bobby

$(DEVHUB_HAPP):
	$(error Download missing hApp into location ./$@)
$(APPSTORE_HAPP):
	$(error Download missing hApp into location ./$@)
copy-devhub-from-local:
	cp ../devhub-dnas/devhub.happ $(DEVHUB_HAPP)
copy-appstore-from-local:
	cp ../app-store-dnas/appstore.happ $(APPSTORE_HAPP)


#
# Testing
#
build:			static-links
	npx webpack
build-watch:		static-links
	WEBPACK_MODE=development npx webpack --watch

test-e2e:		node_modules $(HAPPS)
	npx mocha -t 5000 tests/e2e/
test-e2e-debug:		node_modules $(HAPPS)
	LOG_LEVEL=silly npx mocha -t 5000 tests/e2e/
test-e2e-crud-publishers:	node_modules $(HAPPS)
	LOG_LEVEL=silly npx mocha -t 5000 tests/e2e/test_publisher_crud.js
test-e2e-crud-app:		node_modules $(HAPPS)
	LOG_LEVEL=silly npx mocha -t 5000 tests/e2e/test_app_crud.js

user-testing-setup:
	node ../devhub-gui/tests/create_devhub_assets.js devhub-bobby
	node create_viewpoint.js $$(cat ./tests/AGENT)
	node tests/setup.js app-store andie
	make build-watch

#
# HTTP Server
#
/etc/nginx/sites-available/$(PROJECT_NAME):	tests/nginx/$(PROJECT_NAME)
	sed -e "s|PWD|$(shell pwd)|g" \
	    < $< | sudo tee $@;
	echo " ... Wrote new $@ (from $<)";
	sudo ln -fs ../sites-available/$(PROJECT_NAME) /etc/nginx/sites-enabled/
	sudo systemctl reload nginx.service
	systemctl status nginx


#
# Project
#
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
dist:				static-links static/dist/webpacked.app.js
static/dist/webpacked.app.js:	node_modules webpack.config.js Makefile
	make build
	touch $@
static-links:		node_modules\
	static/dependencies\
	static/dependencies/identicons.bundled.js\
	static/dependencies/holochain-client/holochain-client.js\
	static/dependencies/crux-payload-parser.js\
	static/dependencies/crux-payload-parser.js.map\
	static/dependencies/holo-hash.js\
	static/dependencies/holo-hash.js.map\
	static/dependencies/showdown.js\
	static/dependencies/compressor.js\
	static/dependencies/pako.js\
	static/dependencies/msgpack.js\
	static/dependencies/vue.js\
	static/dependencies/vuex.js\
	static/dependencies/vue-router.js\
	static/web-components/purewc-template.js\
	static/web-components/purewc-select-search.js
static/dependencies:
	mkdir -p $@

static/dependencies/identicons.bundled.js:		node_modules/@whi/identicons/dist/identicons.bundled.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/holochain-client/holochain-client.js:	node_modules/@whi/holochain-client/dist/holochain-client.js Makefile
	ln -fs ../../node_modules/@whi/holochain-client/dist/ static/dependencies/holochain-client

static/dependencies/crux-payload-parser.js:		node_modules/@whi/crux-payload-parser/dist/crux-payload-parser.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/holo-hash.js:			node_modules/@whi/holo-hash/dist/holo-hash.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/showdown.js:			node_modules/showdown/dist/showdown.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/compressor.js:			node_modules/compressorjs/dist/compressor.js Makefile
	cp $< $@

static/dependencies/pako.js:				node_modules/pako/dist/pako.esm.mjs Makefile
	cp $< $@

static/dependencies/msgpack.js:				node_modules/@msgpack/msgpack/dist.es5+umd/msgpack.js Makefile
	cp $< $@
	cp $<.map $@.map

static/dependencies/vue.js:				node_modules/vue/dist/vue.global.js Makefile
	cp $< $@

static/dependencies/vuex.js:				node_modules/vuex/dist/vuex.global.js Makefile
	cp $< $@

static/dependencies/vue-router.js:			node_modules/vue-router/dist/vue-router.global.js Makefile
	cp $< $@
static/web-components/purewc-template.js:		node_modules/@purewc/template/dist/purewc-template.js Makefile
	cp $< $@
	cp $<.map $@.map
static/web-components/purewc-select-search.js:		node_modules/@purewc/select-search/dist/purewc-select-search.js Makefile
	cp $< $@
	cp $<.map $@.map

use-local-crux:
	npm uninstall @whi/crux-payload-parser
	npm install ../js-crux-payload-parser
use-npm-crux:
	npm uninstall @whi/crux-payload-parser
	npm install @whi/crux-payload-parser
use-local-client:
	npm uninstall @whi/holochain-client
	npm install --save ../holochain-client-js/
use-npm-client:
	npm uninstall @whi/holochain-client
	npm install --save @whi/holochain-client

use-local-backdrop:
	npm uninstall @whi/holochain-backdrop
	npm install --save ../node-holochain-backdrop/
use-npm-backdrop:
	npm uninstall @whi/holochain-backdrop
	npm install --save @whi/holochain-backdrop

use-local-openstate:
	npm uninstall openstate
	npm install --save ../openstate-js/
use-npm-openstate:
	npm uninstall openstate
	npm install --save openstate
$(APPSTORE_WEBHAPP):		web_assets.zip tests/appstore.happ
	hc web pack -o $@ ./bundled
	cp $@ ~/
web_assets.zip:			Makefile static/* static/*/* src/* src/*/*
	make build
	cd static; zip -r ../web_assets.zip ./*


#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx
