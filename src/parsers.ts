/* eslint-disable @typescript-eslint/no-explicit-any */
import yaml from 'js-yaml';
import json5 from 'json5';

export interface ConfigParser {
	(text: string): any;
}

const yamlParser: ConfigParser = (text: string): any => yaml.load(text);
const jsonParser: ConfigParser = (text: string): any => JSON.parse(text);
const json5Parser: ConfigParser = (text: string): any => json5.parse(text);

const parsers = {
	yaml: yamlParser,
	yml: yamlParser,
	json: jsonParser,
	json5: json5Parser,
};

export type formats = keyof typeof parsers;

export const getParser = (format: formats): ConfigParser => parsers[format];
