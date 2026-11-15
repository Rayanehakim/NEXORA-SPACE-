import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const cache=new Map();
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
export function moduleUrl(file) {
  const path=resolve(file);
  if(cache.has(path)) return cache.get(path);
  if(extname(path)==='.json') {const url=data(`export default ${readFileSync(path,'utf8')}`);cache.set(path,url);return url;}
  let source=readFileSync(path,'utf8').replace(/^import ['"].*?\.css['"];?\s*$/gm,'').replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'));
  let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  code=code.replace(/from\s+(['"])([^'"]+)\1/g,(_full,_quote,name)=>{
    if(!name.startsWith('.')) return `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`;
    const base=resolve(dirname(path),name);
    const target=[base,base+'.ts',base+'.tsx',resolve(base,'index.tsx'),resolve(base,'index.ts')].find(candidate=>existsSync(candidate)&&statSync(candidate).isFile());
    if(!target) throw Error('Cannot resolve '+name+' from '+path);
    return `from ${JSON.stringify(moduleUrl(target))}`;
  });
  const url=data(code);cache.set(path,url);return url;
}
