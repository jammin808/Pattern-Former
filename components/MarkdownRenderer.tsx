import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Post-process content to wrap tags in spans for styling if needed, 
  // but we can also use regex replacement before passing to ReactMarkdown 
  // or custom components. Here we'll use a simple regex replacer for the specific tags
  // to make them bold and colored, then pass to markdown.
  
  // However, modifying the raw markdown string is safer to keep it compatible with the parser.
  // We will simply style the text output.
  
  const components = {
    // Custom styling for specific elements
    h1: ({node, ...props}: any) => <h1 className="text-xl font-bold text-os-accent mb-4 border-b border-os-border pb-2 uppercase tracking-wider" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-lg font-bold text-gray-200 mt-6 mb-3 flex items-center gap-2" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-md font-bold text-gray-300 mt-4 mb-2" {...props} />,
    p: ({node, ...props}: any) => <p className="mb-3 leading-relaxed text-gray-300" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-4 space-y-1 text-gray-300" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-gray-300" {...props} />,
    li: ({node, ...props}: any) => <li className="" {...props} />,
    strong: ({node, ...props}: any) => <strong className="font-bold text-white" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-os-accent pl-4 py-1 my-4 bg-os-panel italic text-gray-400" {...props} />,
    code: ({node, inline, className, children, ...props}: any) => {
      return !inline ? (
        <div className="bg-black/50 p-4 rounded-md my-4 border border-os-border overflow-x-auto font-mono text-sm">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      ) : (
        <code className="bg-black/50 px-1.5 py-0.5 rounded text-os-accent font-mono text-sm" {...props}>
          {children}
        </code>
      )
    }
  };

  // Helper to highlight specific tags
  const renderContentWithTags = (text: string) => {
    // Split by specific tags to inject styled spans
    const parts = text.split(/(\[GROUNDED\]|\[INFERRED\]|\[SPECULATIVE\]|\[HIGH\]|\[MEDIUM\]|\[LOW\])/g);
    
    return parts.map((part, index) => {
      if (part === '[GROUNDED]') {
        return <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-os-success/10 text-os-success border border-os-success/20 align-middle ml-1 select-none">GROUNDED</span>;
      }
      if (part === '[INFERRED]') {
        return <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-os-warning/10 text-os-warning border border-os-warning/20 align-middle ml-1 select-none">INFERRED</span>;
      }
      if (part === '[SPECULATIVE]') {
        return <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-os-danger/10 text-os-danger border border-os-danger/20 align-middle ml-1 select-none">SPECULATIVE</span>;
      }
       if (part === '[HIGH]') {
        return <span key={index} className="text-os-success font-bold">HIGH</span>;
      }
       if (part === '[MEDIUM]') {
        return <span key={index} className="text-os-warning font-bold">MEDIUM</span>;
      }
       if (part === '[LOW]') {
        return <span key={index} className="text-os-danger font-bold">LOW</span>;
      }
      return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={components}>{part}</ReactMarkdown>;
    });
  };

  // Since ReactMarkdown expects a string, we can't easily inject components mid-stream without breaking the parser 
  // if we do a simple split. 
  // Better approach: Let Markdown render, then highlight using a specific parser or just simple string replacement if text structure is simple.
  // Given the "OS" vibe, let's just use ReactMarkdown and apply styles to `strong` if the prompt outputs them as bold, 
  // OR we rely on the prompt outputting plain text brackets and we style them via a custom plugin.
  // For simplicity and robustness:
  
  return (
    <div className="prose prose-invert max-w-none text-sm font-mono">
       <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        components={{
            ...components,
            // Intercept text nodes to highlight tags
            p: ({node, children, ...props}) => {
                const processChildren = (kids: React.ReactNode): React.ReactNode => {
                     return React.Children.map(kids, (child) => {
                        if (typeof child === 'string') {
                            const split = child.split(/(\[(?:GROUNDED|INFERRED|SPECULATIVE|HIGH|MEDIUM|LOW)\])/g);
                            return split.map((s, i) => {
                                if(s === '[GROUNDED]') return <span key={i} className="text-xs mx-1 text-os-success bg-os-success/10 px-1 rounded border border-os-success/20">GROUNDED</span>
                                if(s === '[INFERRED]') return <span key={i} className="text-xs mx-1 text-os-warning bg-os-warning/10 px-1 rounded border border-os-warning/20">INFERRED</span>
                                if(s === '[SPECULATIVE]') return <span key={i} className="text-xs mx-1 text-os-danger bg-os-danger/10 px-1 rounded border border-os-danger/20">SPECULATIVE</span>
                                if(s === '[HIGH]') return <span key={i} className="text-os-success font-bold">HIGH</span>
                                if(s === '[MEDIUM]') return <span key={i} className="text-os-warning font-bold">MEDIUM</span>
                                if(s === '[LOW]') return <span key={i} className="text-os-danger font-bold">LOW</span>
                                return s;
                            });
                        }
                        return child;
                     });
                };
                return <p className="mb-3 leading-relaxed text-gray-300" {...props}>{processChildren(children)}</p>
            },
            li: ({node, children, ...props}) => {
                const processChildren = (kids: React.ReactNode): React.ReactNode => {
                     return React.Children.map(kids, (child) => {
                        if (typeof child === 'string') {
                            const split = child.split(/(\[(?:GROUNDED|INFERRED|SPECULATIVE|HIGH|MEDIUM|LOW)\])/g);
                            return split.map((s, i) => {
                                if(s === '[GROUNDED]') return <span key={i} className="text-xs mx-1 text-os-success bg-os-success/10 px-1 rounded border border-os-success/20">GROUNDED</span>
                                if(s === '[INFERRED]') return <span key={i} className="text-xs mx-1 text-os-warning bg-os-warning/10 px-1 rounded border border-os-warning/20">INFERRED</span>
                                if(s === '[SPECULATIVE]') return <span key={i} className="text-xs mx-1 text-os-danger bg-os-danger/10 px-1 rounded border border-os-danger/20">SPECULATIVE</span>
                                return s;
                            });
                        }
                        return child;
                     });
                };
                return <li className="" {...props}>{processChildren(children)}</li>
            }
        }}
       >
        {content}
       </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
