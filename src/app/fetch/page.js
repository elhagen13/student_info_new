'use client';

import { useState } from 'react';

export default function Scraper() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScrape = async (e) => {
    e.preventDefault();
    
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || 'Failed to scrape website');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('HTML copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard');
    }
  };

  const downloadHTML = (htmlContent) => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scraped-content.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatHTML = (html) => {
    // Basic HTML formatting for better readability
    return html
      .replace(/></g, '>\n<')
      .replace(/^\s*\n/gm, ''); // Remove empty lines
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>Web Scraper with Puppeteer</h1>
      
      <form onSubmit={handleScrape} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            style={{
              flex: '1',
              minWidth: '300px',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px'
            }}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ccc' : '#007cba',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              minWidth: '120px'
            }}
          >
            {loading ? 'Scraping...' : 'Scrape Website'}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #ffcdd2'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '20px', 
            borderRadius: '6px', 
            marginBottom: '20px',
            border: '1px solid #e9ecef'
          }}>
            <h2 style={{ color: '#28a745', marginTop: '0' }}>✓ Scraping Results</h2>
            <div style={{ marginBottom: '15px' }}>
              <strong>Title:</strong> <span style={{ color: '#666' }}>{result.title}</span>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>URL:</strong> <span style={{ color: '#007cba', wordBreak: 'break-all' }}>{result.url}</span>
            </div>
            <div>
              <strong>HTML Size:</strong> <span style={{ color: '#666' }}>{result.html.length.toLocaleString()} characters</span>
            </div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={() => copyToClipboard(result.html)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px',
                fontSize: '14px'
              }}
            >
              📋 Copy HTML
            </button>
            
            <button
              onClick={() => downloadHTML(result.html)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px',
                fontSize: '14px'
              }}
            >
              💾 Download HTML
            </button>

            <button
              onClick={() => copyToClipboard(formatHTML(result.html))}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📄 Copy Formatted
            </button>
          </div>
          
          <h3>HTML Content:</h3>
          <textarea
            readOnly
            value={result.html}
            style={{
              width: '100%',
              height: '500px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '12px',
              padding: '15px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              backgroundColor: '#f8f9fa',
              resize: 'vertical',
              lineHeight: '1.4'
            }}
          />
        </div>
      )}
    </div>
  );
}
