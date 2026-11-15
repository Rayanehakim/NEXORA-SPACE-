import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { initialMission, updateMission } from './missionState';
import type { Planet, MissionProfile, SimulationReport } from '../types/contracts';
import { targets, sites } from '../data/fixtures/catalog';
interface MissionState {
  planet: Planet;
  targetId: string;
  earthSiteId: string | null;
  missionProfile: MissionProfile;
  simulationReport: SimulationReport | null;
  setPlanet: (value: Planet) => void;
  setTargetId: (value: string) => void;
  setEarthSiteId: (value: string) => void;
  setMissionProfile: (value: MissionProfile) => void;
  setSimulationReport: (value: SimulationReport | null) => void;
}
const Context=createContext<MissionState | null>(null);
export function MissionProvider({children}:{children:ReactNode}){
 const [selection,dispatch]=useReducer((state: ReturnType<typeof initialMission>, action: Parameters<typeof updateMission>[1])=>updateMission(state,action,sites,targets),undefined,()=>initialMission(sites,targets));
 const state=useMemo(()=>({...selection,
   setPlanet:(value:Planet)=>dispatch({type:'planet',value}),
   setTargetId:(value:string)=>dispatch({type:'target',value}),
   setEarthSiteId:(value:string)=>dispatch({type:'site',value}),
   setMissionProfile:(value:MissionProfile)=>dispatch({type:'profile',value}),
   setSimulationReport:(value:SimulationReport|null)=>dispatch({type:'simulation',value})
 }),[selection]);
 return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useMission(){const ctx=useContext(Context);if(!ctx)throw new Error('useMission must run inside MissionProvider');return ctx;}
