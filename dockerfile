FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY . .

# Build (se necessário)
RUN npm run build || true

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]
```

Clique em **Commit changes**

---

### **4. Crie `.dockerignore`:**

Nome do arquivo: `.dockerignore`
```
node_modules
npm-debug.log
.git
.gitignore
.env
.DS_Store
dist
build
.next
coverage
