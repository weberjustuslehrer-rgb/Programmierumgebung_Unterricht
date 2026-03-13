const programs = {
    main: "",
    subs: {}
};

let currentProgram = "main";

export function getCurrentProgramCode(){
    if(currentProgram === "main"){
        return programs.main;
    }
    return programs.subs[currentProgram];
}

export function setCurrentProgramCode(code){
    if(currentProgram === "main"){
        programs.main = code;
    }else{
        programs.subs[currentProgram] = code;
    }
}

export function getCurrentProgramName(){
    if(currentProgram === "main"){
        return "Hauptprogramm";
    }
    return currentProgram;
}

export function addProgram(name){
    programs.subs[name] = "";
}

export function getPrograms(){
    return programs;
}

export function setCurrentProgram(name){
    currentProgram = name;
}