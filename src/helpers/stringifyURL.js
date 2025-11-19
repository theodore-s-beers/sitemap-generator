export default (parsed) =>
  `${parsed.protocol}://${parsed.host}${parsed.uriPath}`;
