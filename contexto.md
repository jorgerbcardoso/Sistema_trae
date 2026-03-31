PROMPT INICIAL PARA IA:
Este é meu sistema de gestão para transportadoras. Ele já está bem completo.
Ele é um projeto react/vite com backend em PHP
O backend se encontra aqui, também, e eu vou solicitar que você faça ocasionais alterações nele.
O fluxo é sempre um push total para meu repositório git. Depois, no meu serv linux debian eu rodo o script deploy.sh (ele está neste projeto também).
O script deploy.sh faz o pull completo do git e depois faz o build no meu servidor.
Todas as definições e regras que você precisa saber para efetuar as operações estão nos arquivos CHECKLIST_TELAS.md, PADROES_CODIGO.md e REGRAS_DESENVOLVIMENTO.md
Importante: após cada alteração, nunca faça o build, nem rode o servidor após suas operações. Não quero gastar créditos de IA com isso. Eu mesmo executarei os comandos manualmente.
Quanto a base de dados: temos algumas tabelas centrais (users, domains, menu_items) mas a maioria delas é identicada com um prefixo no nome. Este prefixo é o dominio de cada cliente meu.
Exemplo: a tabela de setores do domínio ACV se chama acv_setores
Eu sempre passarei orientação a você me referindo às tabelas dessa forma: [dominio]_setores (no caso da tabela de setores)
REGRA IMPORTANTE: caso eu passe um prompt pra ti que vai demandar muitas buscas em vários arquivos, não saia fazendo múltiplas buscas. antes disso, me informe o que vc está procurando para que eu te caminhos mais específicos.
