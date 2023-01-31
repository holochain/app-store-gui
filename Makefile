
SHELL		= bash
PROJECT_NAME	= appstore

APPSTORE_HAPP	= tests/appstore.happ
DEVHUB_HAPP	= tests/devhub.happ
HAPPS		= $(APPSTORE_HAPP) $(DEVHUB_HAPP)


#
# Runtime Setup
#
run-holochain:
	npx holochain-backdrop --admin-port 35678 --config holochain/config.yaml -v
reset-holochain:
	rm -rf holochain/databases holochain/config.yaml tests/*_HASH
reset-lair:
	rm -rf holochain/lair tests/AGENT*
reset-all:		reset-holochain reset-lair
setup:			$(HAPPS)
	node tests/setup.js

$(DEVHUB_HAPP):
	$(error Download missing hApp into location ./$@)
$(APPSTORE_HAPP):
	$(error Download missing hApp into location ./$@)
copy-happ-from-local:
	cp ../../devhub-dnas/DevHub.happ $(DEVHUB_HAPP)


#
# Testing
#
build-watch:		static-links
	WEBPACK_MODE=development npx webpack --watch

test-e2e:		node_modules $(HAPPS)
	npx mocha tests/e2e/
test-e2e:		node_modules $(HAPPS)
	LOG_LEVEL=silly npx mocha tests/e2e/


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
	npm run build
	touch $@
static-links:\
	static/dependencies\
	static/dependencies/identicons.bundled.js\
	static/dependencies/holochain-client/holochain-client.js\
	static/dependencies/crux-payload-parser.js\
	static/dependencies/crux-payload-parser.js.map\
	static/dependencies/holo-hash.js\
	static/dependencies/holo-hash.js.map\
	static/dependencies/showdown.js\
	static/dependencies/vue.js\
	static/dependencies/vuex.js\
	static/dependencies/vue-router.js
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

static/dependencies/vue.js:				node_modules/vue/dist/vue.global.js Makefile
	cp $< $@

static/dependencies/vuex.js:				node_modules/vuex/dist/vuex.global.js Makefile
	cp $< $@

static/dependencies/vue-router.js:			node_modules/vue-router/dist/vue-router.global.js Makefile
	cp $< $@

use-local-client:
	npm uninstall @whi/holochain-client
	npm install --save ../js-holochain-client/whi-holochain-client-0.78.0.tgz
use-npm-client:
	npm uninstall @whi/holochain-client
	npm install --save @whi/holochain-client

use-local-backdrop:
	npm uninstall @whi/holochain-backdrop
	npm install --save ../js-holochain-backdrop/
use-npm-backdrop:
	npm uninstall @whi/holochain-backdrop
	npm install --save @whi/holochain-backdrop


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
