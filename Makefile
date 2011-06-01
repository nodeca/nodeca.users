.PHONY: test docs
.SILENT: test docs


PATH := ./node_modules/.bin:${PATH}


test:
	if test ! `which vows` ; then \
		echo "You need vows installed in order to run tests." >&2 ; \
		echo "  $ npm install vows" >&2 ; \
		exit 128 ;\
		fi
	NODE_ENV=test vows --spec

docs:
	./support/generate-docs.rb
