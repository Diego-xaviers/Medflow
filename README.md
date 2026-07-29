# 🏥 Agendamento Clínica

Sistema de agendamento e gestão para clínicas, construído do zero como projeto de aprendizado prático — do backend em Java ao frontend em React.

## 🎯 Objetivo

Aprender arquitetura de software na prática, construindo um sistema real que futuramente pode evoluir para um SaaS multi-tenant (múltiplas clínicas usando a mesma aplicação).

## 🛠️ Stack

- **Backend**: Java 21 + Spring Boot
- **Banco de dados**: H2 (desenvolvimento) → PostgreSQL (produção, futuro)
- **Frontend**: React + TypeScript (em breve)
- **Build**: Maven

## 📌 Status do projeto

- [x] Configuração inicial do projeto Spring Boot
- [x] Entidade `Paciente`
- [x] `PacienteRepository` (acesso ao banco)
- [x] `PacienteController` — rota `GET /pacientes`
- [ ] Rota `POST /pacientes` (cadastro)
- [ ] Entidades `Profissional` e `Consulta`
- [ ] Relacionamentos entre entidades
- [ ] Regras de negócio de agendamento
- [ ] Autenticação
- [ ] Frontend em React + TypeScript
- [ ] Deploy

## 🚀 Como rodar localmente

\```bash
./mvnw spring-boot:run
\```

A aplicação sobe em `http://localhost:8080`.

## 📖 Sobre este projeto

Este repositório é construído como parte de um processo de aprendizado guiado, com foco em entender **cada conceito de arquitetura** (entidades, repositórios, controllers, injeção de dependência, HTTP) antes de escrever o código — não apenas copiar soluções prontas.
