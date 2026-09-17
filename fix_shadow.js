const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Regex to match:
  // shadowColor: <color>,
  // shadowOffset: { width: <w>, height: <h> },
  // shadowOpacity: <op>,
  // shadowRadius: <rad>,
  // (commas optional on last element)
  
  const regex = /shadowColor:\s*([^,]+),\s*shadowOffset:\s*\{\s*width:\s*([^,]+),\s*height:\s*([^ }]+)\s*\},\s*shadowOpacity:\s*([^,]+),\s*shadowRadius:\s*([0-9.]+),?/g;

  content = content.replace(regex, (match, color, w, h, opacity, radius) => {
    let rgbaStr = '';
    
    // Convert known colors to rgba or hex with alpha
    // Some are '#000', some are Colors.light.primary, etc.
    let alphaHex = Math.round(parseFloat(opacity) * 255).toString(16).padStart(2, '0').toUpperCase();
    
    let replacement = '';
    
    if (color.startsWith("'#") || color.startsWith('\"#')) {
        let hex = color.slice(1, -1);
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        if (hex.length === 7) {
            replacement = `boxShadow: '${w}px ${h}px ${radius}px ${hex}${alphaHex}',`;
        } else {
            replacement = `boxShadow: '${w}px ${h}px ${radius}px ${color.slice(1, -1)}', /* TODO: fix alpha */`;
        }
    } else if (color.includes('Colors.')) {
        replacement = `boxShadow: \`${w}px ${h}px ${radius}px \${${color}}${alphaHex}\`,`;
    } else {
        replacement = `boxShadow: \`${w}px ${h}px ${radius}px \${${color}}\`, /* TODO: check */`;
    }
    
    return replacement;
  });

  if (content !== originalContent) {
    console.log(`Updated ${filePath}`);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

walkDir(path.join(__dirname, 'src'), processFile);
