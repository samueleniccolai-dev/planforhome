import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Root HTML of the static web export. The title is the product name, the same in every language.
export default function Root({ children }: PropsWithChildren) {
  // The bundle scripts, styles and fonts of the export come in as nodes: without them the page never hydrates.
  const { bodyNodes, headNodes } = useServerDocumentContext();
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>planforhome</title>
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
