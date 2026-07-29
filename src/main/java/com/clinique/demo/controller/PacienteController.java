package com.clinique.demo.controller;

import com.clinique.demo.model.Paciente;
import com.clinique.demo.repository.PacienteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@RequestMapping("/pacientes")

public class PacienteController {

    @Autowired
    private PacienteRepository pacienteRepository;

    /* esse metodo aqui e quem responde a requisições GET*/
    @GetMapping
    public List<Paciente> listarTodos() {
        return pacienteRepository.findAll();
    }

}
