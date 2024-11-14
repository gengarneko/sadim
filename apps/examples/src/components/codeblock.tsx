import {Highlight} from 'prism-react-renderer';

export interface CodeblockProps {
  code: string;
}

export const Codeblock = (props: CodeblockProps) => {
  return (
    <Highlight code={props.code} language='tsx'>
      {({className, style, tokens, getLineProps, getTokenProps}) => (
        <pre className={className} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({line, key: i})}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({token, key})} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
};
