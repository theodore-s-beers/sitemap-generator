export default (fpath: string, str: string): string => {
  const ext = fpath.slice(((fpath.lastIndexOf(".") - 1) >>> 0) + 2);

  let newFilename: string;

  if (ext) {
    newFilename = fpath.replace(`.${ext}`, `${str}.${ext}`);
  } else {
    newFilename = `${fpath}${str}`;
  }

  return newFilename;
};
