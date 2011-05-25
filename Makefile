.PHONY: test docs gh-pages
.SILENT: test docs config/app.yml

test:
	@if test ! `which vows` ; then \
		echo "You need vows installed in order to run tests." >&2 ; \
		echo "  $ npm install vows" >&2 ; \
		exit 128 ;\
		fi
	NODE_ENV=test vows --spec

docs:
	./support/generate-docs.rb

config/app.yml:
	echo 'CLI for config creation is not implemented yet.' >&2
	echo 'Please copy config/app.example.yml to config/app.yml' \
		 'and edit your settings to match your needs.' >&2
	exit 128

app: config/app.yml
	node ./index.js
