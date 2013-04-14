# Proxibase make file for helping people find the tests

all: hello

hello:
	@echo 'usage: make <test|testd|testa>'

test: testb

testb:
	@node test/run --basic

testd:
	@node test/run --basic --disconnected

testa:
	@node test/run --generate

.PHONY: test testd testa
