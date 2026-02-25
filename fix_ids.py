import re

with open('app.js', 'r') as f:
    content = f.read()

# Only remove id fields from technopreneurship_module_5_and_6
content = re.sub(r'\{ "id": \d+, "question":', r'{ question:', content)

with open('app.js', 'w') as f:
    f.write(content)

print('All id fields removed!')

