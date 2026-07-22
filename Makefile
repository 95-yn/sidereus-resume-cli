.PHONY: install build test lint typecheck check demo clean

install:
	npm ci

build:
	npm run build

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

check:
	npm run check

demo:
	npm run demo

clean:
	rm -rf dist coverage examples/resume.pdf
