# Proxibase make file for helping people find the tests



all: hello

hello:
	@echo 'usage: make <test|testb|testall>'

test: testb

testb:
	@node test/run --basic

foo:
	@echo $(t) $(wildcard $(t))

testt:
	@node test/run --test $(t)

testall:
	@node test/run --generate

.PHONY: test test-basic test-all
