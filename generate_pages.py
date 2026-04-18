import os
import re

html_file = '/Users/junes/Desktop/parkmate/parkmate/parkmate-marketing-preview.html'
with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract header from <!DOCTYPE html> up to the end of <!-- Navigation -->
header_match = re.search(r'<!DOCTYPE html>.*?</nav>', content, re.DOTALL)
header = header_match.group(0)

# Extract footer
footer_match = re.search(r'<!-- 8\. Footer -->.*', content, re.DOTALL)
footer = footer_match.group(0)

# Replace the internal links in the header and footer to absolute/relative paths if necessary
header = header.replace('href="#', 'href="parkmate-marketing-preview.html#')

# Modify footer links
footer = footer.replace('<a href="#" class="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>', '<a href="privacy-policy.html" class="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>')
footer = footer.replace('<a href="#" class="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>', '<a href="terms-of-service.html" class="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>')

def render_md_to_html(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        md = f.read()
    
    # Replace placeholders
    md = md.replace('[Company Name]', 'ParkMate')
    md = md.replace('[Jurisdiction]', 'Victoria, Australia')
    md = md.replace('[Contact Email]', 'support@parkmate.com')
    
    html_lines = []
    in_list = False
    for line in md.split('\n'):
        # process bold
        line = re.sub(r'\*\*(.*?)\*\*', r'<b class="text-white">\1</b>', line)
        
        if line.startswith('- '):
            if not in_list:
                html_lines.append('<ul class="mb-4">')
                in_list = True
            html_lines.append(f'<li class="text-slate-300 ml-6 list-disc mb-2">{line[2:]}</li>')
            continue
        
        if in_list:
            html_lines.append('</ul>')
            in_list = False
            
        if line.startswith('### '):
            html_lines.append(f'<h3 class="text-2xl font-bold text-white mt-8 mb-4">{line[4:]}</h3>')
        elif line.startswith('## '):
            html_lines.append(f'<h2 class="text-3xl font-bold text-white mt-12 mb-6 border-b border-white/10 pb-4">{line[3:]}</h2>')
        elif line.startswith('# '):
            html_lines.append(f'<h1 class="text-4xl md:text-5xl font-bold text-white mb-8">{line[2:]}</h1>')
        elif line.strip() == '':
            pass
        else:
            html_lines.append(f'<p class="text-slate-300 leading-relaxed mb-4">{line}</p>')
            
    if in_list:
        html_lines.append('</ul>')
        
    return '\n'.join(html_lines)

page_template = f"""{header}
    <section class="py-32 relative min-h-screen">
        <div class="absolute inset-0 bg-[#0b1f33]"></div>
        <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none translate-x-1/2 translate-y-1/2"></div>
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 bg-slate-900/50 p-8 md:p-14 rounded-[40px] border border-white/5 mt-10 shadow-2xl backdrop-blur-sm">
            {{content}}
        </div>
    </section>
{footer}
"""

privacy_content = render_md_to_html('/Users/junes/Desktop/parkmate/parkmate/anything/PRIVACY_POLICY.md')
with open('/Users/junes/Desktop/parkmate/parkmate/privacy-policy.html', 'w', encoding='utf-8') as f:
    f.write(page_template.replace('{content}', privacy_content))

terms_content = render_md_to_html('/Users/junes/Desktop/parkmate/parkmate/anything/TERMS_OF_SERVICE.md')
with open('/Users/junes/Desktop/parkmate/parkmate/terms-of-service.html', 'w', encoding='utf-8') as f:
    f.write(page_template.replace('{content}', terms_content))
    
# also update main index footer
with open(html_file, 'w', encoding='utf-8') as f:
    content = content.replace('<a href="#" class="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>', '<a href="privacy-policy.html" class="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>')
    content = content.replace('<a href="#" class="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>', '<a href="terms-of-service.html" class="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>')
    f.write(content)

