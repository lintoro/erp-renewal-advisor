with open('D:/Github/ReactApp/ERP_dateclean/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 找出在 template 字串內部的 </script>，將其精確替換為 <\/script>
old_str = "    document.getElementById('pwdInput').addEventListener('keypress', (e) => {\n      if (e.key === 'Enter') document.getElementById('unlockBtn').click();\n    });\n  </script>"
new_str = "    document.getElementById('pwdInput').addEventListener('keypress', (e) => {\n      if (e.key === 'Enter') document.getElementById('unlockBtn').click();\n    });\n  <\\/script>"

if old_str in content:
    content = content.replace(old_str, new_str)
    print("Replaced unescaped </script> in template string successfully!")
else:
    print("Warning: old_str not found directly, using regex replace...")
    import re
    # 針對 template 區塊內的 </script> 做替換
    content = re.sub(r"(\s+document\.getElementById\('pwdInput'\)[\s\S]*?)<\/script>", r"\1<\\/script>", content)

with open('D:/Github/ReactApp/ERP_dateclean/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html updated successfully.")
